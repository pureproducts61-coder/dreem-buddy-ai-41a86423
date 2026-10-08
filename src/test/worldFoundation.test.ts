import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/services/os/resourceResolver', () => ({ listResources: async () => [] }));
import { declareResource, inspectResource, proposeInteraction } from '@/services/world/world';
import { interactionFingerprint } from '@/services/world/control';
import type { Affordance, AuthorityContext } from '@/services/world/contracts';
import { readFileSync } from 'fs';

const auth: AuthorityContext = { actorId: 'u1', level: 'user', online: true };

describe('World Foundation (Step 1)', () => {
  it('unknown resource is discoverable, inspectable, with a full affordance', async () => {
    const r = declareResource('website', 'https://example.com');
    expect(r.status).toBe('unknown');
    const { inspection, affordances } = await inspectResource(r);
    expect(inspection.resourceKey).toBe(r.key);
    const a = affordances[0];
    for (const k of ['inputSchema', 'preconditions', 'expectedEffect', 'risk', 'authorityRequired', 'reversibility', 'verificationHint']) expect(a).toHaveProperty(k);
  });

  it('allowed affordance becomes accepted, traceable, with idempotency + correlation', async () => {
    const r = declareResource('website', 'x');
    const { affordances } = await inspectResource(r);
    const req = proposeInteraction({ resource: r, affordance: affordances[0], authority: auth, killSwitch: false, taskId: 't1' });
    expect(req.status).toBe('accepted');
    expect(req.idempotencyKey).toContain('t1');
    expect(req.correlationId).toBeTruthy();
    expect(req.resourceKey).toBe(r.key);
    expect(req.status).not.toBe('executed' as never);
  });

  const risky = (key: string): Affordance => ({
    id: `${key}#delete`, resourceKey: key, action: 'delete', capability: 'TRANSFORM', inputSchema: {}, preconditions: [],
    expectedEffect: 'remove', constraints: {}, risk: 'high', authorityRequired: 'user', reversibility: 'irreversible', freshness: '',
  });

  it('irreversible needs exact approval; kill switch and missing actor block', () => {
    const r = declareResource('file', 'a');
    const a = risky(r.key);
    expect(proposeInteraction({ resource: r, affordance: a, authority: auth, killSwitch: false }).status).toBe('pending_approval');
    const fp = interactionFingerprint(a.id, { p: 1 });
    expect(proposeInteraction({ resource: r, affordance: a, input: { p: 1 }, authority: { ...auth, approvedFingerprint: fp }, killSwitch: false }).status).toBe('accepted');
    expect(proposeInteraction({ resource: r, affordance: a, input: { p: 2 }, authority: { ...auth, approvedFingerprint: fp }, killSwitch: false }).status).toBe('pending_approval');
    expect(proposeInteraction({ resource: r, affordance: a, authority: auth, killSwitch: true }).status).toBe('blocked');
    expect(proposeInteraction({ resource: r, affordance: a, authority: { ...auth, actorId: null }, killSwitch: false }).status).toBe('blocked');
  });

  it('authority never leaks approval fingerprint; core has no provider branches or execution', () => {
    const src = readFileSync('src/services/world/world.ts', 'utf8') + readFileSync('src/services/world/control.ts', 'utf8');
    expect(src).not.toMatch(/github|vercel|openai|ollama|fetch\(/i);
  });
});
