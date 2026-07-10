/**
 * TIVO Smart AI Router
 * ---------------------
 * Dynamically picks the best (provider, model) for a given task type, based
 * on the admin's `ai_provider_configs` + `ai_task_routing` tables.
 *
 * Falls back automatically when a provider is disabled, missing a key, or the
 * request fails at runtime. Keeps a per-session in-memory blacklist so a
 * flaky provider is skipped until reload.
 *
 * Used by the `chat` edge function and any client-side helper that needs to
 * decide "which model should I call for this task right now?".
 */

import { supabase } from '@/integrations/supabase/client';

export type TaskType =
  | 'chat' | 'code' | 'research' | 'vision'
  | 'quick' | 'deep_reasoning' | 'embedding';

export interface ProviderConfig {
  id: string;
  provider: string;
  model: string;
  display_name: string | null;
  api_key_secret_name: string | null;
  base_url: string | null;
  enabled: boolean;
  is_free: boolean;
  priority: number;
  capabilities: string[];
  task_types: string[];
  max_tokens: number | null;
}

const failedConfigIds = new Set<string>();
let cache: { at: number; rows: ProviderConfig[] } | null = null;
const CACHE_MS = 30_000;

export async function loadProviderConfigs(force = false): Promise<ProviderConfig[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const { data, error } = await supabase
    .from('ai_provider_configs')
    .select('*')
    .eq('enabled', true)
    .order('priority', { ascending: true });
  if (error) {
    console.warn('[aiRouter] failed to load configs:', error.message);
    return cache?.rows ?? [];
  }
  const rows = (data ?? []).map((r: any) => ({
    ...r,
    capabilities: Array.isArray(r.capabilities) ? r.capabilities : [],
    task_types: Array.isArray(r.task_types) ? r.task_types : [],
  })) as ProviderConfig[];
  cache = { at: Date.now(), rows };
  return rows;
}

export async function pickProviderForTask(task: TaskType): Promise<ProviderConfig[]> {
  const configs = await loadProviderConfigs();
  const { data: routing } = await supabase
    .from('ai_task_routing')
    .select('*')
    .eq('task_type', task)
    .maybeSingle();

  const eligible = configs
    .filter((c) => !failedConfigIds.has(c.id))
    .filter((c) => c.task_types.length === 0 || c.task_types.includes(task));

  // Manual routing: preferred first, then explicit fallbacks, then rest.
  if (routing && !routing.auto_route && routing.preferred_config_id) {
    const ordered: ProviderConfig[] = [];
    const preferred = eligible.find((c) => c.id === routing.preferred_config_id);
    if (preferred) ordered.push(preferred);
    for (const fid of (routing.fallback_config_ids ?? []) as string[]) {
      const fc = eligible.find((c) => c.id === fid);
      if (fc && !ordered.includes(fc)) ordered.push(fc);
    }
    for (const c of eligible) if (!ordered.includes(c)) ordered.push(c);
    return ordered;
  }

  // Auto: sort by priority (already sorted), free first if two configs have same priority.
  return eligible.sort((a, b) => a.priority - b.priority || (a.is_free === b.is_free ? 0 : a.is_free ? -1 : 1));
}

/** Called by callers when a provider errored so the router skips it next time. */
export function markProviderFailed(configId: string) {
  failedConfigIds.add(configId);
  // Auto-clear after 5 min so transient issues heal.
  setTimeout(() => failedConfigIds.delete(configId), 5 * 60_000);
}

export function clearProviderFailures() {
  failedConfigIds.clear();
}
