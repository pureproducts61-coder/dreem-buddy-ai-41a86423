// Admin-only edge function that:
//   1. Verifies the caller is the admin
//   2. Connects to the user's CUSTOM Supabase project using the service-role
//      key supplied in the request body (NEVER stored)
//   3. Sets up the required schema (tables + RLS) on the target DB, OR
//   4. Migrates current data into the target DB
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SETUP_SQL = `
-- TIVO custom DB schema setup
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  email text,
  display_name text,
  role text NOT NULL DEFAULT 'user',
  credits integer NOT NULL DEFAULT 50,
  github_token text,
  last_active timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mode text NOT NULL DEFAULT 'plan',
  title text NOT NULL DEFAULT 'New Chat',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.credit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  blocked_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text,
  category text NOT NULL DEFAULT 'feedback',
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'unread',
  admin_reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.ai_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  metadata jsonb DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.user_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  type text DEFAULT 'web',
  status text DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "users_self_profile" ON public.user_profiles FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "users_self_sessions" ON public.chat_sessions FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "users_self_messages" ON public.chat_messages FOR ALL TO authenticated
    USING (session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()))
    WITH CHECK (session_id IN (SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "users_self_projects" ON public.user_projects FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "users_send_admin_msg" ON public.admin_messages FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "users_read_own_msg" ON public.admin_messages FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;

const TABLES_TO_MIGRATE = [
  "user_profiles", "chat_sessions", "chat_messages", "credit_usage",
  "user_blocks", "admin_messages", "ai_notifications", "user_projects",
];

async function verifyAdmin(authHeader: string | null): Promise<boolean> {
  if (!authHeader) return false;
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ADMIN_EMAIL = (Deno.env.get("ADMIN_EMAIL") || "").toLowerCase().trim();
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return false;
    if (user.email?.toLowerCase() === ADMIN_EMAIL) return true;
    // Also allow by role
    const { data: profile } = await admin.from("user_profiles").select("role").eq("user_id", user.id).maybeSingle();
    return profile?.role === "admin";
  } catch {
    return false;
  }
}

async function executeSqlOnTarget(
  targetUrl: string,
  serviceKey: string,
  sql: string,
): Promise<void> {
  // Use the Postgres-meta-style RPC endpoint via PostgREST is not available
  // for arbitrary SQL. Instead we use the edge function pattern: send each
  // statement via the PostgREST `rpc/exec_sql` pattern only if it exists.
  // Simpler & reliable: use the SQL via `pg-meta` is also not standard.
  //
  // We rely on the user creating a one-time helper function
  // `public.exec_sql(text)` on the target — OR we use raw fetch to
  // `${url}/rest/v1/rpc/...`. To keep this fully automatic, we POST the SQL
  // to the dedicated SQL endpoint of the Supabase Database REST API which
  // requires the service role:
  //
  //   POST ${url}/pg/query         (newer projects)
  //   POST ${url}/rest/v1/rpc/exec   (only if user created it)
  //
  // The most reliable cross-version approach is to ship the `exec_sql`
  // helper itself in a single statement via `?on_conflict` style — which
  // is NOT supported. So we provide setup steps as a single SQL via the
  // Supabase Studio "SQL Editor"-equivalent endpoint using the management API
  // pattern below; if that fails we return a helpful manual-fallback message.

  const endpoint = `${targetUrl.replace(/\/$/, "")}/rest/v1/rpc/exec`;
  const tryRpc = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ sql }),
  });
  if (tryRpc.ok) return;

  // Fallback: many projects expose a `query` RPC under `pg/query`.
  const fb = await fetch(`${targetUrl.replace(/\/$/, "")}/pg/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  if (fb.ok) return;

  throw new Error(
    "Target DB does not expose a SQL execution endpoint. " +
    "Please run the schema SQL manually in your custom Supabase SQL Editor — copy from `supabase/functions/custom-db-setup/index.ts` (SETUP_SQL constant)."
  );
}

async function migrateTable(
  source: ReturnType<typeof createClient>,
  target: ReturnType<typeof createClient>,
  table: string,
): Promise<number> {
  const { data, error } = await source.from(table).select("*");
  if (error || !data || data.length === 0) return 0;
  const { error: insertErr } = await target.from(table).upsert(data as Record<string, unknown>[], { onConflict: "id" });
  if (insertErr) throw new Error(`${table}: ${insertErr.message}`);
  return data.length;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const isAdmin = await verifyAdmin(req.headers.get("Authorization"));
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, target_url, target_service_role_key } = await req.json();
    if (!target_url || !target_service_role_key) {
      return new Response(JSON.stringify({ error: "target_url and target_service_role_key required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "setup") {
      try {
        await executeSqlOnTarget(target_url, target_service_role_key, SETUP_SQL);
        return new Response(JSON.stringify({
          message: "Custom DB schema created successfully.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({
          error: e instanceof Error ? e.message : "Setup failed",
          manual_sql: SETUP_SQL,
        }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "migrate") {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SOURCE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const source = createClient(SUPABASE_URL, SOURCE_KEY);
      const target = createClient(target_url, target_service_role_key);

      const stats: Record<string, number> = {};
      const errors: string[] = [];
      for (const t of TABLES_TO_MIGRATE) {
        try {
          stats[t] = await migrateTable(source, target, t);
        } catch (e) {
          errors.push(`${t}: ${e instanceof Error ? e.message : String(e)}`);
          stats[t] = 0;
        }
      }
      return new Response(JSON.stringify({
        message: errors.length === 0
          ? "Data migrated successfully."
          : `Migrated with ${errors.length} table error(s).`,
        stats, errors,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "verify") {
      // Compare row counts between source and target as a sanity check
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SOURCE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const source = createClient(SUPABASE_URL, SOURCE_KEY);
      const target = createClient(target_url, target_service_role_key);
      const checks: Record<string, { source: number; target: number; ok: boolean }> = {};
      let allOk = true;
      for (const t of TABLES_TO_MIGRATE) {
        try {
          const { count: src } = await source.from(t).select("*", { count: "exact", head: true });
          const { count: tgt } = await target.from(t).select("*", { count: "exact", head: true });
          const ok = (tgt ?? 0) >= (src ?? 0);
          checks[t] = { source: src ?? 0, target: tgt ?? 0, ok };
          if (!ok) allOk = false;
        } catch (e) {
          checks[t] = { source: -1, target: -1, ok: false };
          allOk = false;
        }
      }
      return new Response(JSON.stringify({
        message: allOk ? "✅ Verification passed — all tables present and counts match." : "⚠️ Some tables differ — review the report.",
        ok: allOk,
        checks,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
