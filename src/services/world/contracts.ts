/**
 * World Foundation contracts (Blueprint Step 1).
 * BRAIN PROPOSES → WORLD DESCRIBES → CONTROL AUTHORIZES → (TDEF later).
 * Nothing here performs an external side effect. Provider-neutral by design:
 * no product names appear in core logic — discoverers/inspectors are plugins.
 */
import type { CredentialRef } from '@/services/os/resourceContracts';

/** The 10-capability stable vocabulary. */
export const CORE_CAPABILITIES = [
  'PERCEIVE', 'UNDERSTAND', 'ACCESS', 'TRANSFORM', 'EXECUTE',
  'GENERATE', 'COMPOSE', 'OBSERVE', 'VERIFY', 'RECOVER',
] as const;
export type CoreCapability = typeof CORE_CAPABILITIES[number];

/** Unknown ≠ Unsupported: 'unknown' is a first-class status. */
export type ResourceStatus = 'unknown' | 'available' | 'degraded' | 'unavailable';

export interface Provenance {
  discoverer: string;
  observedAt: string;
  /** How the fact was obtained: configuration, probe, user declaration… */
  method: 'configuration' | 'probe' | 'declaration' | 'inference';
}

export interface ResourceRef {
  /** Stable key, unique per user (e.g. "<type>:<locator>"). */
  key: string;
  type: string;
  locator: string;
  source: string;
  scope: 'user' | 'project' | 'device' | 'shared';
  status: ResourceStatus;
  /** Non-secret metadata only. */
  metadata: Record<string, unknown>;
  credentialRef?: CredentialRef;
  provenance: Provenance;
  /** ISO time of last observation; consumers judge staleness. */
  freshness: string;
}

export type Risk = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type Reversibility = 'reversible' | 'partially' | 'irreversible' | 'unknown';
export type AuthorityLevel = 'none' | 'user' | 'owner' | 'admin';

export interface Affordance {
  id: string;
  resourceKey: string;
  action: string;
  capability: CoreCapability;
  inputSchema: Record<string, unknown>;
  preconditions: string[];
  expectedEffect: string;
  constraints: Record<string, unknown>;
  risk: Risk;
  authorityRequired: AuthorityLevel;
  reversibility: Reversibility;
  verificationHint?: string;
  freshness: string;
}

export interface Inspection {
  resourceKey: string;
  status: ResourceStatus;
  observations: Array<{ fact: string; value: unknown; provenance: Provenance }>;
  inspectedAt: string;
}

export interface AuthorityContext {
  actorId: string | null;
  level: AuthorityLevel;
  /** Explicit human approval for this specific affordance+input, if granted. */
  approvedFingerprint?: string;
  online: boolean;
}

export type ControlVerdict = 'allow' | 'require_approval' | 'block';

export interface ControlDecision {
  verdict: ControlVerdict;
  reasons: string[];
  risk: Risk;
  reversibility: Reversibility;
  decidedAt: string;
}

/** Step 1 never produces 'executed' — accepted ≠ executed. */
export type InteractionStatus = 'accepted' | 'pending_approval' | 'blocked';

export interface InteractionRequest {
  id?: string;
  taskId: string | null;
  resourceKey: string;
  affordanceId: string;
  action: string;
  input: Record<string, unknown>;
  authorityContext: Omit<AuthorityContext, 'approvedFingerprint'>;
  constraints: Record<string, unknown>;
  expectedEffect: string;
  verificationHint?: string;
  control: ControlDecision;
  idempotencyKey: string;
  correlationId: string;
  status: InteractionStatus;
}

/** Plugin contracts — the only place resource-family knowledge lives. */
export interface Discoverer {
  id: string;
  discover(goal?: string): Promise<ResourceRef[]>;
}
export interface Inspector {
  id: string;
  supports(ref: ResourceRef): boolean;
  inspect(ref: ResourceRef): Promise<Inspection>;
  affordances(ref: ResourceRef, inspection: Inspection): Affordance[];
}
