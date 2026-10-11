import { describe, it, expect } from 'vitest';
import { parseUiSchema, extractUiSchemas } from '@/services/world/dynamicUi';
import { buildEvidence, verify, stageFor } from '@/services/world/evidence';

const prov = { discoverer: 'test', observedAt: '2026-10-11T06:00:00Z', method: 'probe' as const };
const now = new Date('2026-10-11T06:05:00Z');

describe('Dynamic UI schema', () => {
  const approval = { version: 1, blocks: [{ id: 'a1', type: 'approval', action: 'Delete repo', risk: 'high', reversible: false,
    approve: { id: 'ok', label: 'Approve', variant: 'danger' }, reject: { id: 'no', label: 'Reject' } }] };

  it('accepts a valid approval block', () => {
    expect(parseUiSchema(approval)?.blocks[0].type).toBe('approval');
  });
  it('rejects unknown block types, scripts, bad ids and duplicates (fail closed)', () => {
    expect(parseUiSchema({ version: 1, blocks: [{ id: 'x', type: 'html', html: '<b>' }] })).toBeNull();
    expect(parseUiSchema({ version: 1, blocks: [{ id: 'n', type: 'notice', tone: 'info', body: '<script>alert(1)</script>' }] })).toBeNull();
    expect(parseUiSchema({ version: 1, blocks: [{ id: 'bad id!', type: 'notice', tone: 'info' }] })).toBeNull();
    expect(parseUiSchema({ version: 1, blocks: [{ id: 'd', type: 'notice', tone: 'info' }, { id: 'd', type: 'notice', tone: 'info' }] })).toBeNull();
    expect(parseUiSchema({ version: 2, blocks: [] })).toBeNull();
    expect(parseUiSchema('not json')).toBeNull();
  });
  it('extracts tivo-ui fences from brain text', () => {
    const msg = 'Need approval:\n```tivo-ui\n' + JSON.stringify(approval) + '\n```';
    const r = extractUiSchemas(msg);
    expect(r.schemas).toHaveLength(1);
    expect(r.text).toBe('Need approval:');
  });
});

describe('Evidence & verification', () => {
  const obs = [{ fact: 'run.conclusion', value: 'success', observedAt: '2026-10-11T06:04:00Z', source: 'gh' }];

  it('PASS only when all expectations match trusted evidence', () => {
    const ev = buildEvidence('build ok', obs, prov, now);
    expect(ev.trust).toBe('trusted');
    expect(verify([ev], [{ fact: 'run.conclusion', equals: 'success' }]).status).toBe('PASS');
    expect(stageFor(verify([ev], [{ fact: 'run.conclusion', equals: 'success' }]), false)).toBe('verified');
  });
  it('FAILED / PARTIAL / UNCERTAIN / NOT_VERIFIABLE / BLOCKED are truthful', () => {
    const ev = buildEvidence('build', obs, prov, now);
    expect(verify([ev], [{ fact: 'run.conclusion', equals: 'failure' }]).status).toBe('FAILED');
    expect(verify([ev], [{ fact: 'run.conclusion' }, { fact: 'artifact' }]).status).toBe('PARTIAL');
    expect(verify([], [{ fact: 'artifact' }]).status).toBe('UNCERTAIN');
    expect(verify([ev], []).status).toBe('NOT_VERIFIABLE');
    expect(verify([ev], [{ fact: 'x' }], { blocked: true }).status).toBe('BLOCKED');
  });
  it('stale and conflicting evidence is never trusted', () => {
    const stale = buildEvidence('old', obs, prov, new Date('2026-10-12T00:00:00Z'));
    expect(stale.trust).toBe('stale');
    expect(verify([stale], [{ fact: 'run.conclusion' }]).status).toBe('UNCERTAIN');
    const conflict = buildEvidence('c', [...obs, { ...obs[0], value: 'failure' }], prov, now);
    expect(conflict.trust).toBe('conflicting');
    expect(conflict.confidence).toBe(0);
  });
});
