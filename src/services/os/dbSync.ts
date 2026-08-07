/**
 * Database hot-reload for the AI OS registries.
 *
 * The Constitution, Brain, Plugin Registry and Capability overrides are the
 * primary intelligence of TIVO. They live in `ai_os_config` so that any change
 * saved from the Admin Panel is picked up by every session immediately —
 * no restart, no redeploy, no page refresh. Local registries stay the offline
 * source of truth; the database is the shared, always-newest copy.
 */
import { supabase } from '@/integrations/supabase/client';
import type { LocalRegistry, RegistryRecord } from './registry';
import { constitution } from './constitution';
import { brainRegistry } from './brain';
import { pluginRegistry } from './plugins';
import { bridgePermissions } from './desktopBridge';
import { modelRegistry } from './modelManager';

interface SyncedRegistry {
  key: string;
  registry: LocalRegistry<RegistryRecord>;
  /** permissions/models are device-local; they are never pushed to the cloud */
  deviceLocal?: boolean;
}

function synced(): SyncedRegistry[] {
  return [
    { key: 'constitution', registry: constitution as unknown as LocalRegistry<RegistryRecord> },
    { key: 'brain', registry: brainRegistry as unknown as LocalRegistry<RegistryRecord> },
    { key: 'plugins', registry: pluginRegistry as unknown as LocalRegistry<RegistryRecord> },
    { key: 'models', registry: modelRegistry as unknown as LocalRegistry<RegistryRecord>, deviceLocal: true },
    { key: 'permissions', registry: bridgePermissions as unknown as LocalRegistry<RegistryRecord>, deviceLocal: true },
  ];
}

const lastSeen = new Map<string, string>();
let started = false;
let isAdmin = false;

const listeners = new Set<() => void>();
export const subscribeConfigReload = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const emit = () => listeners.forEach((l) => l());

let lastReloadAt: string | null = null;
export const lastConfigReload = () => lastReloadAt;

/** Pull one registry from the database into the local store. */
async function pull(entry: SyncedRegistry) {
  const { data, error } = await supabase
    .from('ai_os_config')
    .select('payload, updated_at')
    .eq('id', entry.key)
    .maybeSingle();
  if (error || !data) return false;
  const rows = (data.payload as { records?: RegistryRecord[] } | null)?.records;
  if (!Array.isArray(rows) || !rows.length) return false;
  const serialized = JSON.stringify(rows);
  if (lastSeen.get(entry.key) === serialized) return false;
  lastSeen.set(entry.key, serialized);
  entry.registry.replaceAll(rows);
  lastReloadAt = new Date().toISOString();
  return true;
}

/** Push the local registry to the database (admins only — RLS enforces it). */
export async function pushRegistry(key: string) {
  if (!isAdmin) return;
  const entry = synced().find((s) => s.key === key);
  if (!entry || entry.deviceLocal) return;
  const records = entry.registry.getAll();
  const serialized = JSON.stringify(records);
  if (lastSeen.get(key) === serialized) return;
  lastSeen.set(key, serialized);
  await supabase.from('ai_os_config').upsert({
    id: key,
    payload: { records } as never,
    revision: `${records.length}:${serialized.length}`,
    updated_at: new Date().toISOString(),
  }).then(() => undefined, () => undefined);
}

/** Force a fresh read of every shared registry. Safe to call often. */
export async function reloadAiConfig(): Promise<boolean> {
  let changed = false;
  for (const entry of synced()) {
    if (entry.deviceLocal) continue;
    try { changed = (await pull(entry)) || changed; } catch { /* offline — keep local */ }
  }
  if (changed) emit();
  return changed;
}

/**
 * Start hot reload: initial pull, realtime subscription, local-change push and
 * a slow safety poll for environments where realtime is unavailable.
 */
export async function startConfigSync() {
  if (started) return;
  started = true;

  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: profile } = await supabase
      .from('user_profiles').select('role').eq('user_id', data.user.id).maybeSingle();
    isAdmin = profile?.role === 'admin';
  } catch { /* offline — local registries stay authoritative */ }

  await reloadAiConfig();

  // Local edits (Admin Panel) propagate to the database instantly.
  for (const entry of synced()) {
    if (entry.deviceLocal) continue;
    entry.registry.subscribe(() => { void pushRegistry(entry.key); });
  }

  // Realtime: another admin's change lands here within a second.
  try {
    supabase
      .channel('ai-os-config')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_os_config' }, () => { void reloadAiConfig(); })
      .subscribe();
  } catch { /* realtime unavailable */ }

  // Safety net for flaky networks / suspended tabs.
  setInterval(() => { void reloadAiConfig(); }, 60_000);
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { void reloadAiConfig(); });
    window.addEventListener('focus', () => { void reloadAiConfig(); });
  }
}
