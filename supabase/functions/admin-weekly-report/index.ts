import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("ADMIN_REPORT_CRON_SECRET") || "";
  const incomingSecret = req.headers.get("x-cron-secret") || "";
  const authHeader = req.headers.get("Authorization") || "";
  const admin = createClient(supabaseUrl, serviceKey);

  if (cronSecret && incomingSecret !== cronSecret) {
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  const now = new Date();
  const periodEnd = now.toISOString();
  const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [audit, profiles, emergency, approvals] = await Promise.all([
    admin.from("admin_audit_log").select("event_type,actor_email,actor_id,target_table,created_at,note").gte("created_at", periodStart).order("created_at", { ascending: false }).limit(500),
    admin.from("user_profiles").select("email,last_active,role").gte("last_active", periodStart).order("last_active", { ascending: false }).limit(200),
    admin.from("emergency_contacts").select("email,subject,status,created_at,updated_at").gte("created_at", periodStart).order("created_at", { ascending: false }).limit(200),
    admin.from("automation_approvals").select("action_type,title,status,user_email,created_at,decided_at").gte("created_at", periodStart).order("created_at", { ascending: false }).limit(200),
  ]);

  const events = audit.data || [];
  const summary = {
    period_start: periodStart,
    period_end: periodEnd,
    logins: events.filter((e) => String(e.event_type).startsWith("auth.")).length,
    kill_switch_actions: events.filter((e) => String(e.event_type).startsWith("kill_switch")).length,
    emergency_access_events: events.filter((e) => String(e.event_type).startsWith("emergency_contact")).length,
    recovery_events: events.filter((e) => String(e.event_type).startsWith("recovery.")).length,
    active_users: profiles.data || [],
    emergency_contacts: emergency.data || [],
    approvals: approvals.data || [],
    security_regression_status: "configured_in_vitest_security_regression_suite",
  };

  const { data: report, error } = await admin.from("admin_weekly_reports").insert({
    period_start: periodStart,
    period_end: periodEnd,
    summary,
    status: "generated",
  }).select("id").single();
  if (error) throw error;

  await admin.from("ai_notifications").insert({
    title: "Weekly admin security report ready",
    body: `${summary.logins} auth events, ${summary.recovery_events} recovery events, ${summary.emergency_access_events} emergency events this week.`,
    type: summary.recovery_events > 0 || summary.emergency_access_events > 0 ? "warning" : "success",
    metadata: { audience: "admin", report_id: report?.id, period_start: periodStart, period_end: periodEnd },
  });

  await admin.from("admin_audit_log").insert({
    event_type: "weekly_report.generated",
    target_table: "admin_weekly_reports",
    target_id: report?.id || null,
    after: summary,
    note: "weekly admin report",
  });

  return new Response(JSON.stringify({ ok: true, report_id: report?.id, summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});