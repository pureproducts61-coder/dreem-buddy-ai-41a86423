/**
 * World layer: discovery → inspection → affordances → control → InteractionRequest.
 * Step 1 boundary: NO external side effects. Requests are recorded, never executed.
 */
import { supabase } from '@/integrations/supabase/client';
import { listResources } from '@/services/os/resourceResolver';
import type {
  Affordance, AuthorityContext, Discoverer, Inspection, Inspector, InteractionRequest, ResourceRef,
} from './contracts';
import { evaluateControl } from './control';

const discoverers = new Map<string, Discoverer>();
const inspectors = new Map<string, Inspector>();
export const registerDiscoverer = (d: Discoverer) => { discoverers.set(d.id, d); };
export const registerInspector = (i: Inspector) => { inspectors.set(i.id, i); };

const nowIso = () => new Date().toISOString();

/** Generic discoverer over already-configured resources (Registry ≠ World truth: status stays 'unknown'). */
registerDiscoverer({
  id: 'configured-resources',
  async discover() {
    const list = await listResources().catch(() => []);
    return list.map((r): ResourceRef => ({
      key: `${r.type}:${r.id}`,
      type: r.type,
      locator: r.id,
      source: r.source,
      scope: 'shared',
      status: r.readiness === 'unavailable' ? 'unavailable' : r.readiness === 'healthy' ? 'available' : 'unknown',
      metadata: { name: r.name, capabilities: r.capabilities, readiness: r.readiness, config: r.config },
      credentialRef: r.credentialRef,
      provenance: { discoverer: 'configured-resources', observedAt: nowIso(), method: 'configuration' },
      freshness: nowIso(),
    }));
  },
});

/** Generic fallback inspector: reports what is known without probing. Read-only affordance only. */
registerInspector({
  id: 'generic',
  supports: () => true,
  async inspect(ref) {
    return {
      resourceKey: ref.key,
      status: ref.status,
      observations: [{ fact: 'declared', value: ref.metadata, provenance: ref.provenance }],
      inspectedAt: nowIso(),
    };
  },
  affordances(ref) {
    return [{
      id: `${ref.key}#describe`,
      resourceKey: ref.key,
      action: 'describe',
      capability: 'OBSERVE',
      inputSchema: {},
      preconditions: [],
      expectedEffect: 'Read current description; no change to the resource',
      constraints: {},
      risk: 'none',
      authorityRequired: 'user',
      reversibility: 'reversible',
      verificationHint: 'description returned',
      freshness: nowIso(),
    }];
  },
});

export async function discoverResources(goal?: string): Promise<ResourceRef[]> {
  const out = new Map<string, ResourceRef>();
  for (const d of discoverers.values()) {
    try {
      for (const r of await d.discover(goal)) {
        const prev = out.get(r.key);
        // Fresh observation outranks stale; never silently drop a conflict.
        if (!prev || prev.freshness <= r.freshness) {
          if (prev && prev.status !== r.status) r.metadata = { ...r.metadata, conflict: { previous: prev.status, from: prev.provenance.discoverer } };
          out.set(r.key, r);
        }
      }
    } catch { /* one failing discoverer never hides the others */ }
  }
  return [...out.values()];
}

/** Explicit, user-declared resource (unknown resources are discoverable). */
export function declareResource(type: string, locator: string, metadata: Record<string, unknown> = {}): ResourceRef {
  return {
    key: `${type}:${locator}`, type, locator, source: 'declaration', scope: 'user', status: 'unknown',
    metadata, provenance: { discoverer: 'user', observedAt: nowIso(), method: 'declaration' }, freshness: nowIso(),
  };
}

function inspectorFor(ref: ResourceRef): Inspector {
  for (const i of inspectors.values()) if (i.id !== 'generic' && i.supports(ref)) return i;
  return inspectors.get('generic')!;
}

export async function inspectResource(ref: ResourceRef): Promise<{ inspection: Inspection; affordances: Affordance[] }> {
  const ins = inspectorFor(ref);
  const inspection = await ins.inspect(ref);
  return { inspection, affordances: ins.affordances(ref, inspection) };
}

/** Builds an InteractionRequest after Control. Pure — persistence is separate. */
export function proposeInteraction(params: {
  resource: ResourceRef; affordance: Affordance; input?: Record<string, unknown>;
  authority: AuthorityContext; killSwitch: boolean; taskId?: string | null; correlationId?: string;
}): InteractionRequest {
  const input = params.input ?? {};
  const control = evaluateControl(params.resource, params.affordance, input, params.authority, { killSwitch: params.killSwitch });
  const { approvedFingerprint: _omit, ...authorityContext } = params.authority;
  const status = control.verdict === 'allow' ? 'accepted' : control.verdict === 'require_approval' ? 'pending_approval' : 'blocked';
  const idem = `${params.taskId ?? 'adhoc'}:${params.affordance.id}:${JSON.stringify(input, Object.keys(input).sort())}`;
  return {
    taskId: params.taskId ?? null,
    resourceKey: params.resource.key,
    affordanceId: params.affordance.id,
    action: params.affordance.action,
    input,
    authorityContext,
    constraints: params.affordance.constraints,
    expectedEffect: params.affordance.expectedEffect,
    verificationHint: params.affordance.verificationHint,
    control,
    idempotencyKey: idem,
    correlationId: params.correlationId ?? crypto.randomUUID(),
    status,
  };
}

const SECRETISH = /(key|token|secret|password|authorization|cookie)/i;
function scrub(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, SECRETISH.test(k) ? '[redacted]' : v]));
}

/** Persists resource, affordance and request (RLS-scoped to the signed-in user). Idempotent. */
export async function recordInteraction(resource: ResourceRef, affordance: Affordance, req: InteractionRequest) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { ok: false as const, error: 'not signed in' };
  const user_id = u.user.id;

  const { data: res, error: e1 } = await supabase.from('world_resources').upsert({
    user_id, ref_key: resource.key, type: resource.type, locator: resource.locator, source: resource.source,
    scope: resource.scope, status: resource.status, metadata: scrub(resource.metadata) as never,
    provenance: { ...resource.provenance, credentialRef: resource.credentialRef ? { secretName: resource.credentialRef.secretName, present: resource.credentialRef.present } : null } as never,
    observed_at: resource.freshness, updated_at: nowIso(),
  }, { onConflict: 'user_id,ref_key' }).select('id').single();
  if (e1 || !res) return { ok: false as const, error: e1?.message ?? 'resource save failed' };

  const { data: aff, error: e2 } = await supabase.from('world_affordances').upsert({
    user_id, resource_id: res.id, action: affordance.action, input_schema: affordance.inputSchema as never,
    preconditions: affordance.preconditions as never, expected_effect: affordance.expectedEffect,
    constraints: affordance.constraints as never, risk: affordance.risk, authority_required: affordance.authorityRequired,
    reversibility: affordance.reversibility, verification_hint: affordance.verificationHint ?? null, observed_at: affordance.freshness,
  }, { onConflict: 'resource_id,action' }).select('id').single();
  if (e2 || !aff) return { ok: false as const, error: e2?.message ?? 'affordance save failed' };

  const { data: row, error: e3 } = await supabase.from('interaction_requests').insert({
    user_id, task_id: req.taskId, resource_id: res.id, affordance_id: aff.id, input: scrub(req.input) as never,
    authority_context: req.authorityContext as never, constraints: req.constraints as never,
    expected_effect: req.expectedEffect, verification_hint: req.verificationHint ?? null,
    control_decision: req.control as never, idempotency_key: req.idempotencyKey,
    correlation_id: req.correlationId, status: req.status,
  }).select('id').single();
  if (e3?.code === '23505') return { ok: true as const, id: null, duplicate: true };
  if (e3 || !row) return { ok: false as const, error: e3?.message ?? 'request save failed' };
  return { ok: true as const, id: row.id, duplicate: false };
}
