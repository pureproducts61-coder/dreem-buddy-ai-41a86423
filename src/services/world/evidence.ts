/**
 * Observation, Evidence & Verification contracts (Blueprint Step 3/4 foundation).
 * Pure functions only — no side effects. Turns raw TDEF observations into
 * Evidence with provenance/confidence/freshness, and derives a truthful
 * verification status. Accepted ≠ executed ≠ verified.
 */
import type { Provenance } from './contracts';

export type TrustStatus = 'trusted' | 'unverified' | 'stale' | 'conflicting';

export type VerificationStatus =
  | 'PASS' | 'PARTIAL' | 'FAILED' | 'UNCERTAIN' | 'BLOCKED' | 'NOT_VERIFIABLE';

export type LifecycleStage =
  | 'proposed' | 'authorized' | 'executing' | 'observed' | 'verified' | 'failed' | 'blocked';

export interface Observation {
  fact: string;
  value: unknown;
  observedAt: string;
  source: string;
}

export interface Evidence {
  id: string;
  claim: string;
  observations: Observation[];
  provenance: Provenance;
  /** 0..1 — never inflated; derived from observation count and agreement. */
  confidence: number;
  freshness: string;
  trust: TrustStatus;
}

export interface ExpectationCheck {
  /** Observation fact name that must be present. */
  fact: string;
  /** Optional exact expected value. */
  equals?: unknown;
}

export interface VerificationResult {
  status: VerificationStatus;
  passed: string[];
  failed: string[];
  missing: string[];
  reasons: string[];
  verifiedAt: string;
}

const DEFAULT_MAX_AGE_MS = 15 * 60 * 1000;

export function buildEvidence(
  claim: string,
  observations: Observation[],
  provenance: Provenance,
  now: Date = new Date(),
  maxAgeMs = DEFAULT_MAX_AGE_MS,
): Evidence {
  const times = observations.map((o) => Date.parse(o.observedAt)).filter((t) => !Number.isNaN(t));
  const newest = times.length ? Math.max(...times) : NaN;
  const freshness = Number.isNaN(newest) ? provenance.observedAt : new Date(newest).toISOString();

  // Conflicting = same fact observed with different values.
  const byFact = new Map<string, string>();
  let conflicting = false;
  for (const o of observations) {
    const v = JSON.stringify(o.value);
    const prev = byFact.get(o.fact);
    if (prev !== undefined && prev !== v) conflicting = true;
    byFact.set(o.fact, v);
  }

  const stale = Number.isNaN(newest) || now.getTime() - newest > maxAgeMs;
  let trust: TrustStatus = 'trusted';
  if (observations.length === 0) trust = 'unverified';
  else if (conflicting) trust = 'conflicting';
  else if (stale) trust = 'stale';

  const base = observations.length === 0 ? 0 : Math.min(1, 0.5 + 0.1 * byFact.size);
  const confidence = trust === 'trusted' ? base : trust === 'stale' ? base * 0.5 : 0;

  return {
    id: `ev_${provenance.discoverer}_${freshness}`,
    claim,
    observations,
    provenance,
    confidence: Math.round(confidence * 100) / 100,
    freshness,
    trust,
  };
}

export function verify(
  evidence: Evidence[],
  expectations: ExpectationCheck[],
  opts: { blocked?: boolean; now?: Date } = {},
): VerificationResult {
  const verifiedAt = (opts.now ?? new Date()).toISOString();
  const empty = { passed: [], failed: [], missing: [], verifiedAt };
  if (opts.blocked) return { ...empty, status: 'BLOCKED', reasons: ['Control blocked the action'] };
  if (expectations.length === 0) {
    return { ...empty, status: 'NOT_VERIFIABLE', reasons: ['No verifiable expectation was declared'] };
  }
  if (evidence.some((e) => e.trust === 'conflicting')) {
    return { ...empty, status: 'UNCERTAIN', reasons: ['Evidence contains conflicting observations'] };
  }

  const usable = evidence.filter((e) => e.trust === 'trusted');
  const facts = new Map<string, unknown>();
  for (const e of usable) for (const o of e.observations) facts.set(o.fact, o.value);

  const passed: string[] = [], failed: string[] = [], missing: string[] = [];
  for (const x of expectations) {
    if (!facts.has(x.fact)) missing.push(x.fact);
    else if ('equals' in x && JSON.stringify(facts.get(x.fact)) !== JSON.stringify(x.equals)) failed.push(x.fact);
    else passed.push(x.fact);
  }

  let status: VerificationStatus;
  if (failed.length) status = passed.length ? 'PARTIAL' : 'FAILED';
  else if (missing.length) status = passed.length ? 'PARTIAL' : 'UNCERTAIN';
  else status = 'PASS';

  const reasons: string[] = [];
  if (evidence.length > usable.length) reasons.push('Some evidence was stale or unverified and ignored');
  if (failed.length) reasons.push(`Mismatched: ${failed.join(', ')}`);
  if (missing.length) reasons.push(`No evidence for: ${missing.join(', ')}`);
  return { status, passed, failed, missing, reasons, verifiedAt };
}

/** Map verification to the truthful lifecycle stage shown in UI. */
export function stageFor(result: VerificationResult | null, executing: boolean): LifecycleStage {
  if (executing) return 'executing';
  if (!result) return 'observed';
  if (result.status === 'PASS') return 'verified';
  if (result.status === 'BLOCKED') return 'blocked';
  if (result.status === 'FAILED') return 'failed';
  return 'observed';
}
