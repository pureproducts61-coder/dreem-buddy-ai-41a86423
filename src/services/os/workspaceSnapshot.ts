/**
 * Unified WorkspaceSnapshot.
 * Android sends the app to the background aggressively; when the user comes
 * back the workspace must look exactly as they left it instead of booting from
 * scratch. The snapshot lives in IndexedDB (never the network) and is written
 * with a debounce so it can never cause duplicate writes or jank.
 *
 * Secrets are never stored — saveOfflineState() scrubs token-like fields.
 */
import { loadOfflineState, saveOfflineState } from './offlineState';

export interface WorkspaceSnapshot {
  route: string;
  tab: string | null;
  projectId: string | null;
  conversationId: string | null;
  mode: string | null;
  draft: string | null;
  scrollTop: number | null;
  runtimeId: string | null;
  modelId: string | null;
  preferences: Record<string, unknown>;
  savedAt: string;
}

const KEY = 'workspace-snapshot';

const EMPTY: WorkspaceSnapshot = {
  route: '/', tab: null, projectId: null, conversationId: null, mode: null,
  draft: null, scrollTop: null, runtimeId: null, modelId: null, preferences: {},
  savedAt: new Date(0).toISOString(),
};

let current: WorkspaceSnapshot = { ...EMPTY };
let userId: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let restored = false;

export const getSnapshot = () => current;

/** Restore synchronously-usable state before the first paint of the workspace. */
export async function restoreSnapshot(uid: string | null): Promise<WorkspaceSnapshot> {
  userId = uid;
  if (restored) return current;
  const saved = await loadOfflineState<WorkspaceSnapshot>(uid, KEY);
  current = saved ? { ...EMPTY, ...saved } : { ...EMPTY };
  restored = true;
  return current;
}

function flush() {
  timer = null;
  void saveOfflineState(userId, KEY, current);
}

/** Merge a partial update. Debounced — safe to call on every keystroke. */
export function updateSnapshot(patch: Partial<WorkspaceSnapshot>) {
  const next = { ...current, ...patch, savedAt: new Date().toISOString() };
  // Skip identical writes (mobile performance: no duplicate IndexedDB traffic).
  const { savedAt: _a, ...a } = next;
  const { savedAt: _b, ...b } = current;
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  current = next;
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, 600);
}

export function flushSnapshotNow() {
  if (timer) { clearTimeout(timer); timer = null; }
  flush();
}

/** Persist immediately when Android backgrounds or kills the app. */
export function startSnapshotPersistence() {
  if (typeof document === 'undefined') return;
  const onHide = () => { if (document.visibilityState === 'hidden') flushSnapshotNow(); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flushSnapshotNow);
}
