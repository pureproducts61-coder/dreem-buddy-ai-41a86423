// Edge function: bootstraps the admin account using ADMIN_EMAIL + ADMIN_PASSWORD secrets.
// Flow when called from the Login page with { email, password }:
//   1. If credentials match the secrets, ensure the auth user exists (create if missing).
//   2. Promote the user to admin role in user_profiles via service role.
//   3. Return { ok: true } so the client can call signInWithPassword normally.
// Never returns or logs the password. Always uses constant-time-ish comparison via length+equality.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { email, password } = await req.json().catch(() => ({}));
    if (typeof email !== "string" || typeof password !== "string") {
      return new Response(JSON.stringify({ error: "bad_request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminEmail = (Deno.env.get("ADMIN_EMAIL") || "").trim().toLowerCase();
    const adminPassword = Deno.env.get("ADMIN_PASSWORD") || "";
    if (!adminEmail || !adminPassword) {
      return new Response(JSON.stringify({ error: "not_configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const incomingEmail = email.trim().toLowerCase();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: allowlisted } = await admin
      .from("admin_email_allowlist")
      .select("id")
      .eq("email", incomingEmail)
      .maybeSingle();
    const emailOk = safeEqual(incomingEmail, adminEmail) || !!allowlisted;
    const passOk = safeEqual(password, adminPassword);
    if (!emailOk || !passOk) {
      // Don't leak which one mismatched
      return new Response(JSON.stringify({ error: "invalid_admin_credentials" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find existing user by email
    let userId: string | null = null;
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) {
      console.error("admin-bootstrap listUsers failed:", listErr.message);
      return new Response(JSON.stringify({ error: "internal_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const targetEmail = incomingEmail;
    const existing = list.users.find((u) => (u.email || "").toLowerCase() === targetEmail);

    if (existing) {
      userId = existing.id;
      // Reset password to current secret (in case it changed) and ensure email confirmed
      await admin.auth.admin.updateUserById(existing.id, {
        password: adminPassword,
        email_confirm: true,
      });
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: targetEmail,
        password: adminPassword,
        email_confirm: true,
      });
      if (createErr || !created.user) {
        console.error("admin-bootstrap createUser failed:", createErr?.message);
        return new Response(JSON.stringify({ error: "internal_error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = created.user.id;
    }

    // Promote / upsert profile as admin
    await admin.from("user_profiles").upsert(
      {
        user_id: userId,
        email: targetEmail,
        role: "admin",
        last_active: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-bootstrap unhandled error:", e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});