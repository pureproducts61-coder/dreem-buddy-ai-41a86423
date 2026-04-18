// Edge function: checks if the current authenticated user's email matches ADMIN_EMAIL secret
// and promotes them to admin role in user_profiles automatically.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "no_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminEmail = (Deno.env.get("ADMIN_EMAIL") || "").trim().toLowerCase();

    // Get current user from JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "invalid_user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userEmail = (user.email || "").trim().toLowerCase();
    const isAdminEmail = !!adminEmail && userEmail === adminEmail;

    // Use service role to upsert profile and promote if needed
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Ensure profile exists
    const { data: existing } = await adminClient
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      await adminClient.from("user_profiles").insert({
        user_id: user.id,
        email: user.email,
        role: isAdminEmail ? "admin" : "user",
      });
    } else if (isAdminEmail && existing.role !== "admin") {
      await adminClient
        .from("user_profiles")
        .update({ role: "admin", last_active: new Date().toISOString() })
        .eq("user_id", user.id);
    } else {
      await adminClient
        .from("user_profiles")
        .update({ last_active: new Date().toISOString() })
        .eq("user_id", user.id);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        isAdmin: isAdminEmail,
        role: isAdminEmail ? "admin" : (existing?.role || "user"),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e instanceof Error ? e.message : e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
