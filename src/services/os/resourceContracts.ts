/**
 * Shared configuration contract layer (Phase 1 foundation).
 * ---------------------------------------------------------
 * Gives TIVO one vocabulary for "what is configured" so future Power/Agent
 * code can ask for a CAPABILITY instead of hardcoding a specific service.
 *
 * Rules encoded here:
 *  - Credentials are referenced by NAME only. A raw secret value never enters
 *    a descriptor, a log, a type or the chat surface.
 *  - Configuration is NOT health. A descriptor only says "an admin configured
 *    this"; runtime readiness stays with the capability registry / health checks.
 */

/** Capability identifier, e.g. "ai.chat", "code.repository", "deploy.web". */
export type CapabilityId = string;

/** Where a piece of configuration came from. */
export type ConfigSource = 'ai_provider_configs' | 'ai_task_routing' | 'system_settings' | 'plugin' | 'runtime';

/** A reference to a secret — never the secret value itself. */
export interface CredentialRef {
  /** Name/key of the secret as stored by the existing Key/Value/Secrets UI. */
  secretName: string;
  source: ConfigSource;
  /** True when a non-empty value is known to exist for this name (value itself is never read out). */
  present: boolean;
}

/** A configured resource (an AI provider, a repository host, a deploy target…). */
export interface ResourceDescriptor {
  id: string;
  /** Generic family, e.g. "ai-provider", "service". Never a hardcoded product name in core logic. */
  type: string;
  name: string;
  capabilities: CapabilityId[];
  /** Task types this resource is configured for (empty = any). */
  taskTypes: string[];
  credentialRef?: CredentialRef;
  /** Non-secret configuration only (base urls, model names, flags). */
  config: Record<string, string | number | boolean>;
  source: ConfigSource;
  /** Lower runs first. */
  priority: number;
  enabled: boolean;
}

/** Normalized status of any execution through a connector. */
export type ExecutionStatus = 'success' | 'failure' | 'unavailable' | 'requires-approval';

export interface ExecutionRequest {
  capability: CapabilityId;
  /** Connector-specific action name. */
  action: string;
  /** Optional pinned resource; otherwise the resolver picks one. */
  resourceId?: string;
  taskType?: string;
  input?: Record<string, unknown>;
  /** Deduplication key for idempotent retries. */
  idempotencyKey?: string;
}

export interface ExecutionResult<T = unknown> {
  status: ExecutionStatus;
  /** Only true for a verified success — never optimistic. */
  ok: boolean;
  resourceId?: string;
  data?: T;
  error?: string;
  checkedAt: string;
}

/** Contract every future connector implementation must satisfy. */
export interface Connector {
  id: string;
  type: string;
  supports(capability: CapabilityId): boolean;
  /** Configuration presence only; health lives elsewhere. */
  describe(): ResourceDescriptor;
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}

export const unavailableResult = (error: string, resourceId?: string): ExecutionResult => ({
  status: 'unavailable', ok: false, error, resourceId, checkedAt: new Date().toISOString(),
});

export const failureResult = (error: string, resourceId?: string): ExecutionResult => ({
  status: 'failure', ok: false, error, resourceId, checkedAt: new Date().toISOString(),
});

export const successResult = <T>(data: T, resourceId?: string): ExecutionResult<T> => ({
  status: 'success', ok: true, data, resourceId, checkedAt: new Date().toISOString(),
});
