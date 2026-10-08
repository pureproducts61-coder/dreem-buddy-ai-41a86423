/**
 * Control plane for the World Foundation. Pure + deterministic: it only decides.
 * No approval → no acceptance. Irreversible / high risk needs explicit approval.
 */
import type {
  Affordance, AuthorityContext, AuthorityLevel, ControlDecision, ResourceRef,
} from './contracts';

const LEVEL_RANK: Record<AuthorityLevel, number> = { none: 0, user: 1, owner: 2, admin: 3 };

/** Stable fingerprint binding an approval to one exact affordance + input. */
export function interactionFingerprint(affordanceId: string, input: Record<string, unknown>): string {
  const canon = JSON.stringify(input, Object.keys(input).sort());
  let h = 2166136261;
  const s = `${affordanceId}|${canon}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `fp_${(h >>> 0).toString(16)}`;
}

export interface ControlEnv { killSwitch: boolean; now?: Date }

export function evaluateControl(
  resource: ResourceRef,
  affordance: Affordance,
  input: Record<string, unknown>,
  authority: AuthorityContext,
  env: ControlEnv,
): ControlDecision {
  const reasons: string[] = [];
  const decidedAt = (env.now ?? new Date()).toISOString();
  const base = { risk: affordance.risk, reversibility: affordance.reversibility, decidedAt };
  const block = (r: string): ControlDecision => ({ verdict: 'block', reasons: [...reasons, r], ...base });

  if (env.killSwitch) return block('kill switch is active');
  if (!authority.actorId) return block('no authenticated actor');
  if (affordance.resourceKey !== resource.key) return block('affordance does not belong to resource');
  if (resource.status === 'unavailable') return block('resource unavailable');
  if (LEVEL_RANK[authority.level] < LEVEL_RANK[affordance.authorityRequired]) {
    return block(`authority ${authority.level} < required ${affordance.authorityRequired}`);
  }
  if (!authority.online && resource.source !== 'local') return block('offline: online-only resource');
  if (resource.status === 'unknown') reasons.push('resource status unknown (not unsupported)');

  const needsApproval = affordance.risk === 'high' || affordance.risk === 'critical'
    || affordance.reversibility === 'irreversible'
    || (affordance.reversibility === 'unknown' && affordance.risk !== 'none');

  if (needsApproval) {
    const fp = interactionFingerprint(affordance.id, input);
    if (authority.approvedFingerprint !== fp) {
      return { verdict: 'require_approval', reasons: [...reasons, 'explicit approval required'], ...base };
    }
    reasons.push('approved for this exact input');
  }
  return { verdict: 'allow', reasons, ...base };
}
