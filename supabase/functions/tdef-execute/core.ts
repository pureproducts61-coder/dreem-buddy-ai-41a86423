/**
 * TDEF core (pure, runtime-agnostic). Server re-checks Control, then dispatches
 * to a registered RuntimeProvider. No network/filesystem in this module.
 */
export type ExecStatus =
  | 'started' | 'running' | 'completed' | 'failed' | 'timed_out'
  | 'cancelled' | 'unknown' | 'refused' | 'runtime_unavailable';

export interface Observation { fact: string; value: unknown; observedAt: string; source: string }

export interface GateInput {
  request: { status: string; action: string; affordance_id: string; resource_id: string };
  affordance: { id: string; resource_id: string; action: string; risk: string; reversibility: string } | null;
  resource: { id: string; type: string; locator: string; status: string; metadata: unknown; observed_at: string } | null;
  killSwitch: boolean | null;
}

/** Server-side Control re-check. Never trusts the client's stored decision alone. */
export function gate(g: GateInput): { ok: true } | { ok: false; reason: string } {
  if (g.killSwitch !== false) return { ok: false, reason: 'kill switch active or unknown' };
  if (g.request.status !== 'accepted') return { ok: false, reason: `request is ${g.request.status}` };
  if (!g.affordance || !g.resource) return { ok: false, reason: 'affordance or resource missing' };
  if (g.affordance.id !== g.request.affordance_id || g.affordance.resource_id !== g.resource.id || g.request.resource_id !== g.resource.id)
    return { ok: false, reason: 'request/affordance/resource mismatch' };
  if (g.affordance.action !== g.request.action && g.request.action) return { ok: false, reason: 'action mismatch' };
  if (g.resource.status === 'unavailable') return { ok: false, reason: 'resource unavailable' };
  const risky = ['high', 'critical'].includes(g.affordance.risk) || g.affordance.reversibility === 'irreversible'
    || (g.affordance.reversibility === 'unknown' && g.affordance.risk !== 'none');
  // No server-backed approval store yet → risky affordances fail closed.
  if (risky) return { ok: false, reason: 'approval-required affordances are not executable yet (no server approval record)' };
  return { ok: true };
}

export interface RuntimeContext { resource: NonNullable<GateInput['resource']>; action: string; signal: AbortSignal; now: () => string }
export interface RuntimeProvider {
  id: string;
  actions: string[];
  limits: { timeoutMs: number; network: 'none'; filesystem: 'none' };
  available(): boolean;
  run(ctx: RuntimeContext): Promise<Observation[]>;
}

/** First runtime: pure in-process read of the stored description. */
export const observeDescribe: RuntimeProvider = {
  id: 'observe-describe',
  actions: ['describe'],
  limits: { timeoutMs: 3000, network: 'none', filesystem: 'none' },
  available: () => true,
  async run({ resource, now }) {
    return [
      { fact: 'resource.type', value: resource.type, observedAt: now(), source: 'observe-describe' },
      { fact: 'resource.locator', value: resource.locator, observedAt: now(), source: 'observe-describe' },
      { fact: 'resource.status', value: resource.status, observedAt: now(), source: 'observe-describe' },
      { fact: 'resource.metadata', value: resource.metadata, observedAt: now(), source: 'observe-describe' },
      { fact: 'resource.freshness', value: resource.observed_at, observedAt: now(), source: 'observe-describe' },
    ];
  },
};

export const defaultRegistry: RuntimeProvider[] = [observeDescribe];

export function resolveRuntime(registry: RuntimeProvider[], action: string): RuntimeProvider | null {
  return registry.find((p) => p.actions.includes(action) && p.available()) ?? null;
}

export interface DispatchResult { status: ExecStatus; runtimeId: string | null; observations: Observation[]; error: string | null; durationMs: number }

export async function dispatch(g: GateInput, registry: RuntimeProvider[], now = () => new Date().toISOString()): Promise<DispatchResult> {
  const t0 = Date.now();
  const verdict = gate(g);
  if (verdict.ok === false) return { status: 'refused', runtimeId: null, observations: [], error: verdict.reason, durationMs: 0 };
  const rt = resolveRuntime(registry, g.affordance!.action);
  if (!rt) return { status: 'runtime_unavailable', runtimeId: null, observations: [], error: 'no runtime supports this action', durationMs: 0 };
  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((r) => { timer = setTimeout(() => { ac.abort(); r('timeout'); }, rt.limits.timeoutMs); });
  try {
    const out = await Promise.race([rt.run({ resource: g.resource!, action: g.affordance!.action, signal: ac.signal, now }), timeout]);
    if (out === 'timeout') return { status: 'timed_out', runtimeId: rt.id, observations: [], error: `exceeded ${rt.limits.timeoutMs}ms`, durationMs: Date.now() - t0 };
    return { status: 'completed', runtimeId: rt.id, observations: out, error: null, durationMs: Date.now() - t0 };
  } catch (e) {
    return { status: 'failed', runtimeId: rt.id, observations: [], error: e instanceof Error ? e.message : 'runtime error', durationMs: Date.now() - t0 };
  } finally { clearTimeout(timer); }
}

/** Terminal states are returned as-is; 'unknown'/'started'/'running' must be reconciled, never blindly re-run. */
export const TERMINAL: ReadonlySet<ExecStatus> = new Set(['completed', 'failed', 'timed_out', 'cancelled', 'refused', 'runtime_unavailable']);
