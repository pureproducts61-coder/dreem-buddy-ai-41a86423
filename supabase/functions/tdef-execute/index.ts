import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { defaultRegistry, dispatch, TERMINAL } from './core.ts';

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!service) return json({ error: 'server not configured' }, 500);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
  const userDb = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: u, error: ue } = await userDb.auth.getUser(auth.slice(7));
  if (ue || !u.user) return json({ error: 'unauthorized' }, 401);

  let body: { requestId?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const requestId = typeof body.requestId === 'string' && UUID.test(body.requestId) ? body.requestId : null;
  if (!requestId) return json({ error: 'requestId must be a uuid' }, 400);

  // Read through the user's client → RLS guarantees ownership.
  const { data: request } = await userDb.from('interaction_requests')
    .select('id,status,affordance_id,resource_id,input').eq('id', requestId).maybeSingle();
  if (!request) return json({ error: 'not found' }, 404);

  const admin = createClient(url, service);
  const { data: existing } = await admin.from('interaction_executions').select('*').eq('request_id', requestId).maybeSingle();
  if (existing) {
    // Idempotent: never run twice. Non-terminal = needs reconciliation, not re-execution.
    return json({ execution: existing, reused: true, reconcile: !TERMINAL.has(existing.status) });
  }

  const [{ data: affordance }, { data: resource }, { data: ks }] = await Promise.all([
    userDb.from('world_affordances').select('id,resource_id,action,risk,reversibility').eq('id', request.affordance_id).maybeSingle(),
    userDb.from('world_resources').select('id,type,locator,status,metadata,observed_at').eq('id', request.resource_id).maybeSingle(),
    admin.rpc('get_kill_switch_state'),
  ]);
  const killSwitch = Array.isArray(ks) && ks.length ? Boolean(ks[0].kill_switch) : ks === null ? null : false;

  // Claim the slot first (unique request_id) so concurrent calls cannot both run.
  const { data: claim, error: ce } = await admin.from('interaction_executions')
    .insert({ user_id: u.user.id, request_id: requestId, status: 'started' }).select('id').single();
  if (ce || !claim) {
    const { data: again } = await admin.from('interaction_executions').select('*').eq('request_id', requestId).maybeSingle();
    return json({ execution: again, reused: true, reconcile: again ? !TERMINAL.has(again.status) : true });
  }

  const result = await dispatch({
    request: { status: request.status, action: affordance?.action ?? '', affordance_id: request.affordance_id, resource_id: request.resource_id },
    affordance: affordance ?? null, resource: resource ?? null, killSwitch,
  }, defaultRegistry);

  const { data: row } = await admin.from('interaction_executions').update({
    status: result.status, runtime_id: result.runtimeId, observations: result.observations,
    error: result.error, duration_ms: result.durationMs, finished_at: new Date().toISOString(),
  }).eq('id', claim.id).select('*').single();

  return json({ execution: row ?? { status: 'unknown' }, reused: false, reconcile: !row });
});
