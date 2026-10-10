import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { dispatch, gate, observeDescribe, type GateInput, type RuntimeProvider } from '../../supabase/functions/tdef-execute/core';

const base = (): GateInput => ({
  request: { status: 'accepted', action: 'describe', affordance_id: 'a1', resource_id: 'r1' },
  affordance: { id: 'a1', resource_id: 'r1', action: 'describe', risk: 'none', reversibility: 'reversible' },
  resource: { id: 'r1', type: 'website', locator: 'x', status: 'unknown', metadata: {}, observed_at: 't' },
  killSwitch: false,
});

describe('TDEF (Step 2)', () => {
  it('accepted + safe request runs through the registered runtime', async () => {
    const r = await dispatch(base(), [observeDescribe]);
    expect(r.status).toBe('completed');
    expect(r.runtimeId).toBe('observe-describe');
    expect(r.observations.length).toBeGreaterThan(0);
  });

  it('blocked / pending / kill-switch / unknown kill switch never reach a runtime', async () => {
    const spy: RuntimeProvider = { ...observeDescribe, run: vi.fn(async () => []) };
    for (const g of [
      { ...base(), request: { ...base().request, status: 'blocked' } },
      { ...base(), request: { ...base().request, status: 'pending_approval' } },
      { ...base(), killSwitch: true },
      { ...base(), killSwitch: null },
      { ...base(), affordance: { ...base().affordance!, risk: 'high' } },
      { ...base(), affordance: { ...base().affordance!, resource_id: 'other' } },
    ]) expect((await dispatch(g, [spy])).status).toBe('refused');
    expect(spy.run).not.toHaveBeenCalled();
  });

  it('empty registry fails closed', async () => {
    expect((await dispatch(base(), [])).status).toBe('runtime_unavailable');
  });

  it('timeout is distinct from failure', async () => {
    const slow: RuntimeProvider = { ...observeDescribe, limits: { ...observeDescribe.limits, timeoutMs: 10 }, run: () => new Promise(() => {}) };
    expect((await dispatch(base(), [slow])).status).toBe('timed_out');
    const bad: RuntimeProvider = { ...observeDescribe, run: async () => { throw new Error('x'); } };
    expect((await dispatch(base(), [bad])).status).toBe('failed');
  });

  it('gate rejects unavailable resources', () => {
    expect(gate({ ...base(), resource: { ...base().resource!, status: 'unavailable' } }).ok).toBe(false);
  });

  it('runtime core has no network/filesystem access; server is idempotent', () => {
    const core = readFileSync('supabase/functions/tdef-execute/core.ts', 'utf8');
    expect(core).not.toMatch(/fetch\(|Deno\.(read|write|open|run|Command)|import\s.*['"](node:)?fs['"]/);
    const idx = readFileSync('supabase/functions/tdef-execute/index.ts', 'utf8');
    expect(idx).toMatch(/reused: true/);
    expect(idx).toMatch(/status: 'started'/);
  });
});
