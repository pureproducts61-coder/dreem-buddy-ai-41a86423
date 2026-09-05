/**
 * Data Lifecycle Manager.
 *
 * Local data is the source of truth; the cloud is a mirror. This module decides
 * what may expire and what must never be touched automatically.
 *
 *   permanent       projects, important memory, settings   → never auto-deleted
 *   user-controlled chats, knowledge, files                → only on explicit request
 *   expirable       notifications, old reports, activity   → auto after retention
 *   temporary       cache, runtime logs, temp jobs         → auto, short retention
 *
 * Automatic cleanup only ever touches `expirable` and `temporary`.
 */
import { idbDel, idbGet, idbKeys, idbSet } from './idbStore';

export type DataCategory = 'permanent' | 'user-controlled' | 'expirable' | 'temporary';

export interface DataRule {
  id: string;
  label: string;
  category: DataCategory;
  /** localStorage key prefixes owned by this rule. */
  localPrefixes: string[];
  /** IndexedDB (kv store) key prefixes owned by this rule. */
  idbPrefixes: string[];
  retentionDays: number | null;
}

export const DATA_RULES: DataRule[] = [
  { id: 'projects', label: 'Projects & workspace files', category: 'permanent', localPrefixes: ['tivo-os-workspace'], idbPrefixes: ['project:'], retentionDays: null },
  { id: 'settings', label: 'Settings & preferences', category: 'permanent', localPrefixes: ['tivo-theme', 'tivo-language', 'tivo-os-engines', 'tivo-os-permissions'], idbPrefixes: [], retentionDays: null },
  { id: 'memory', label: 'AI memory & Brain config', category: 'permanent', localPrefixes: ['tivo-os-brain', 'tivo-os-constitution'], idbPrefixes: ['registry:tivo-os-brain'], retentionDays: null },
  { id: 'chats', label: 'Chat history', category: 'user-controlled', localPrefixes: [], idbPrefixes: ['chat:'], retentionDays: null },
  { id: 'reports', label: 'Reports & self-test history', category: 'expirable', localPrefixes: ['tivo-os-selftest'], idbPrefixes: ['report:'], retentionDays: 30 },
  { id: 'activity', label: 'Activity & notifications', category: 'expirable', localPrefixes: ['tivo-os-permission-audit'], idbPrefixes: ['activity:', 'notification:'], retentionDays: 14 },
  { id: 'cache', label: 'Cache & runtime logs', category: 'temporary', localPrefixes: ['tivo-os-ollama-state', 'tivo-cache-'], idbPrefixes: ['cache:', 'log:'], retentionDays: 3 },
];

const LAST_RUN = 'tivo-os-cleanup-at';

interface Stamped { __at?: string }

async function purgePrefix(prefix: string, olderThanDays: number | null) {
  const keys = (await idbKeys()) || [];
  const cutoff = olderThanDays === null ? null : Date.now() - olderThanDays * 86_400_000;
  for (const k of keys) {
    const key = String(k);
    if (!key.startsWith(prefix)) continue;
    if (cutoff === null) { await idbDel(key); continue; }
    const row = await idbGet<Stamped>(key);
    const at = row?.__at ? Date.parse(row.__at) : NaN;
    if (Number.isNaN(at) || at < cutoff) await idbDel(key);
  }
}

export interface CleanupResult { rule: string; removedLocalKeys: number }

/**
 * Automatic maintenance. Runs at most once a day and only over expirable and
 * temporary data — user projects, memory and files are never touched.
 */
export async function runAutomaticCleanup(force = false): Promise<CleanupResult[]> {
  const last = Number(localStorage.getItem(LAST_RUN) || 0);
  if (!force && Date.now() - last < 86_400_000) return [];
  localStorage.setItem(LAST_RUN, String(Date.now()));

  const results: CleanupResult[] = [];
  for (const rule of DATA_RULES) {
    if (rule.category !== 'expirable' && rule.category !== 'temporary') continue;
    let removed = 0;
    if (rule.category === 'temporary') {
      for (const p of rule.localPrefixes) {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith(p)) { localStorage.removeItem(key); removed++; }
        }
      }
    }
    for (const p of rule.idbPrefixes) await purgePrefix(p, rule.retentionDays);
    results.push({ rule: rule.id, removedLocalKeys: removed });
  }
  return results;
}

/** Explicit, user-triggered clear of one data group (used by the UI controls). */
export async function clearDataGroup(ruleId: string): Promise<boolean> {
  const rule = DATA_RULES.find((r) => r.id === ruleId);
  if (!rule) return false;
  for (const p of rule.localPrefixes) {
    for (const key of Object.keys(localStorage)) if (key.startsWith(p)) localStorage.removeItem(key);
  }
  for (const p of rule.idbPrefixes) await purgePrefix(p, null);
  return true;
}

export interface StorageUsage { usedBytes: number; quotaBytes: number; persisted: boolean }

export async function storageUsage(): Promise<StorageUsage> {
  try {
    const est = await navigator.storage?.estimate?.();
    const persisted = (await navigator.storage?.persisted?.()) ?? false;
    return { usedBytes: est?.usage ?? 0, quotaBytes: est?.quota ?? 0, persisted };
  } catch {
    return { usedBytes: 0, quotaBytes: 0, persisted: false };
  }
}

/** Stamp a record so retention can age it out later. */
export const stamp = <T extends object>(value: T): T & Stamped => ({ ...value, __at: new Date().toISOString() });
export const putStamped = (key: string, value: object) => idbSet(key, stamp(value));
