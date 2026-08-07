/**
 * PWA self-setup. On first launch the app builds everything it needs to run
 * offline: a local workspace, cache, database and the AI folder tree.
 * Re-running is safe — missing pieces are repaired, existing data is kept.
 */
import { ensureSeedPermissions } from './desktopBridge';
import { reportRuntimeCapability } from './capabilities';

const STATE_KEY = 'tivo-os-workspace';
const DB_NAME = 'tivo-os-workspace';
const DB_VERSION = 1;
export const WORKSPACE_STORES = ['files', 'cache', 'memory', 'backups', 'kv'] as const;

export const WORKSPACE_FOLDERS = [
  'workspace', 'workspace/projects', 'workspace/exports',
  'ai', 'ai/models', 'ai/plugins', 'ai/constitution', 'ai/knowledge', 'ai/memory',
  'cache', 'backups', 'logs',
];

export interface WorkspaceState {
  initialised: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  folders: string[];
  stores: string[];
  persistent: boolean;
  quotaGb: number;
}

export function getWorkspaceState(): WorkspaceState | null {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); } catch { return null; }
}

function openWorkspaceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      WORKSPACE_STORES.forEach((s) => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s); });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function workspacePut(store: typeof WORKSPACE_STORES[number], key: string, value: unknown) {
  const db = await openWorkspaceDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function workspaceGet<T = unknown>(store: typeof WORKSPACE_STORES[number], key: string): Promise<T | null> {
  const db = await openWorkspaceDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Creates the whole local environment. Idempotent. */
export async function bootstrapWorkspace(): Promise<WorkspaceState> {
  const existing = getWorkspaceState();
  const db = await openWorkspaceDb();
  const stores = [...db.objectStoreNames];

  // Folder tree is virtual (IndexedDB paths) and mirrored to the Bridge when present.
  const folders = WORKSPACE_FOLDERS;
  for (const path of folders) {
    const marker = await workspaceGet('files', `${path}/.keep`).catch(() => null);
    if (!marker) await workspacePut('files', `${path}/.keep`, { createdAt: new Date().toISOString() }).catch(() => {});
  }

  let persistent = false;
  try { persistent = (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.()) || false; } catch { /* ignore */ }
  let quotaGb = 0;
  try { quotaGb = ((await navigator.storage?.estimate?.())?.quota || 0) / 1e9; } catch { /* ignore */ }

  ensureSeedPermissions();

  const state: WorkspaceState = {
    initialised: true,
    version: DB_VERSION,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    folders, stores, persistent, quotaGb,
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
  reportRuntimeCapability({
    id: 'offline-workspace', label: 'Offline workspace',
    state: 'ready', health: stores.length ? 'good' : 'degraded',
    detail: `${folders.length} folders, ${stores.length} local stores, ${quotaGb.toFixed(1)} GB available`,
  });
  return state;
}
