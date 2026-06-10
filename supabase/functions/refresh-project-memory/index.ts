import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function summarizeFiles(files: Array<{ path?: string; content?: string }>) {
  return files
    .filter((f) => f.path && typeof f.content === "string")
    .slice(0, 25)
    .map((f) => `## ${f.path}\n${String(f.content).slice(0, 2500)}`)
    .join("\n\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const body = await req.json().catch(() => ({}));
  const files = Array.isArray(body.files) ? body.files : [];
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : "project context refresh";
  const content = summarizeFiles(files);
  if (!content) {
    return new Response(JSON.stringify({ error: "no_context" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  await admin.from("ai_memory_entries").insert({
    user_id: user.id,
    topic: "Project code/UI context refresh",
    content,
    summary: `Updated project context from ${files.length} changed file(s): ${files.map((f: { path?: string }) => f.path).filter(Boolean).slice(0, 8).join(", ")}`,
    metadata: { source: "refresh-project-memory", note, file_count: files.length },
  });

  await admin.from("admin_audit_log").insert({
    actor_id: user.id,
    actor_email: user.email || null,
    event_type: "memory.project_context_refreshed",
    target_table: "ai_memory_entries",
    after: { file_count: files.length, note },
    note,
  });

  return new Response(JSON.stringify({ ok: true, file_count: files.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});