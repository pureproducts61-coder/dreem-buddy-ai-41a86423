/**
 * Resource / Capability Resolver.
 * -------------------------------
 * Reads the EXISTING admin configuration (ai_provider_configs, ai_task_routing,
 * system_settings) and normalizes it into ResourceDescriptors so callers can ask
 * "which configured resource supports capability X for task Y?".
 *
 * It is deliberately generic: no service-specific names or logic live here.
 * Secret values are never read or returned — only secret NAMES (CredentialRef).
 * A descriptor means "configured", never "healthy" or "ready".
 */
import { loadProviderConfigs, pickProviderForTask, type TaskType } from '@/services/aiRouter';
import { loadLocalSystemSettings, loadSystemSettingsFromDb } from '@/services/systemSettingsService';
import type { CapabilityId, CredentialRef, ExecutionResult, ResourceDescriptor } from './resourceContracts';
import { unavailableResult } from './resourceContracts';

/** Capability every AI provider config satisfies, plus its declared extras. */
const AI_BASE_CAPABILITY = 'ai.chat';

/** Derive a generic capability id from a settings key holding a credential. */
function capabilityFromSecretKey(key: string): CapabilityId {
  const service = key.replace(/(ApiKey|Token|Secret|Key)$/i, '');
  return `service.${service.toLowerCase()}`;
}

function isCredentialKey(key: string): boolean {
  return /(ApiKey|Token|Secret)$/i.test(key);
}

async function providerResources(): Promise<ResourceDescriptor[]> {
  const configs = await loadProviderConfigs().catch(() => []);
  return configs.map((c) => ({
    id: c.id,
    type: 'ai-provider',
    name: c.display_name || `${c.provider}/${c.model}`,
    capabilities: [AI_BASE_CAPABILITY, ...c.capabilities.map((x) => `ai.${x}`)],
    taskTypes: c.task_types,
    credentialRef: c.api_key_secret_name
      ? ({ secretName: c.api_key_secret_name, source: 'ai_provider_configs', present: true } satisfies CredentialRef)
      : undefined,
    config: {
      provider: c.provider,
      model: c.model,
      is_free: c.is_free,
      ...(c.base_url ? { base_url: c.base_url } : {}),
      ...(c.max_tokens ? { max_tokens: c.max_tokens } : {}),
    },
    source: 'ai_provider_configs' as const,
    priority: c.priority,
    enabled: c.enabled,
  }));
}

async function settingsResources(): Promise<ResourceDescriptor[]> {
  const [local, remote] = await Promise.all([
    Promise.resolve(loadLocalSystemSettings()).catch(() => ({})),
    loadSystemSettingsFromDb().catch(() => ({})),
  ]);
  const merged = { ...local, ...remote } as Record<string, string | number | boolean>;
  const out: ResourceDescriptor[] = [];
  for (const [key, value] of Object.entries(merged)) {
    if (!isCredentialKey(key)) continue;
    const present = typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
    out.push({
      id: `system_settings:${key}`,
      type: 'service',
      name: key,
      capabilities: [capabilityFromSecretKey(key)],
      taskTypes: [],
      credentialRef: { secretName: key, source: 'system_settings', present },
      config: {},
      source: 'system_settings',
      priority: 50,
      enabled: present,
    });
  }
  return out;
}

let cache: { at: number; rows: ResourceDescriptor[] } | null = null;
const CACHE_MS = 30_000;

/** All configured resources, normalized. Never includes secret values. */
export async function listResources(force = false): Promise<ResourceDescriptor[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const rows = [...(await providerResources()), ...(await settingsResources())];
  cache = { at: Date.now(), rows };
  return rows;
}

export function invalidateResourceCache() { cache = null; }

export interface ResolveQuery {
  capability: CapabilityId;
  taskType?: string;
}

/** Every configured resource that declares the capability (config only, not health). */
export async function resolveResources(query: ResolveQuery): Promise<ResourceDescriptor[]> {
  const all = await listResources();
  return all
    .filter((r) => r.enabled && r.capabilities.includes(query.capability))
    .filter((r) => !query.taskType || r.taskTypes.length === 0 || r.taskTypes.includes(query.taskType))
    .sort((a, b) => a.priority - b.priority);
}

/**
 * "Which configured resource supports capability X for task Y?"
 * Returns a truthful unavailable result when nothing is configured.
 */
export async function resolveResource(
  query: ResolveQuery,
): Promise<ExecutionResult<ResourceDescriptor>> {
  // AI chat honours the existing routing table so behaviour stays unchanged.
  if (query.capability === AI_BASE_CAPABILITY && query.taskType) {
    const ordered = await pickProviderForTask(query.taskType as TaskType).catch(() => []);
    if (ordered.length) {
      const all = await listResources();
      const match = all.find((r) => r.id === ordered[0].id);
      if (match) return { status: 'success', ok: true, data: match, resourceId: match.id, checkedAt: new Date().toISOString() };
    }
  }
  const matches = await resolveResources(query);
  if (!matches.length) {
    return unavailableResult(
      `No resource is configured for capability "${query.capability}"${query.taskType ? ` (task: ${query.taskType})` : ''}.`,
    ) as ExecutionResult<ResourceDescriptor>;
  }
  const chosen = matches[0];
  return { status: 'success', ok: true, data: chosen, resourceId: chosen.id, checkedAt: new Date().toISOString() };
}

/** Credential reference (secret NAME only) for a capability, if one is configured. */
export async function resolveCredentialRef(query: ResolveQuery): Promise<CredentialRef | null> {
  const res = await resolveResource(query);
  return res.ok ? res.data?.credentialRef ?? null : null;
}

/** Configuration presence check. Explicitly NOT a readiness/health check. */
export async function isCapabilityConfigured(capability: CapabilityId, taskType?: string): Promise<boolean> {
  return (await resolveResources({ capability, taskType })).length > 0;
}
