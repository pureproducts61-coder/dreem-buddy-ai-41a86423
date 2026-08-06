/**
 * Smart update system for the installed PWA.
 * Checks periodically, downloads only what changed and never touches user data,
 * models, plugins, constitution, projects, chats or settings.
 */
import { startBridgeAutoUpdate, updateBridge } from './bridgeInstaller';

const LAST_KEY = 'tivo-os-last-update-check';

export interface UpdateState {
  checking: boolean;
  updateReady: boolean;
  lastCheckedAt: string | null;
}

const listeners = new Set<(s: UpdateState) => void>();
let state: UpdateState = { checking: false, updateReady: false, lastCheckedAt: localStorage.getItem(LAST_KEY) };

export const subscribeUpdates = (fn: (s: UpdateState) => void) => {
  listeners.add(fn);
  fn(state);
  return () => { listeners.delete(fn); };
};
const emit = () => listeners.forEach((l) => l(state));

export async function checkForAppUpdate(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  state = { ...state, checking: true };
  emit();
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update();
    const ready = Boolean(reg?.waiting);
    state = { checking: false, updateReady: ready, lastCheckedAt: new Date().toISOString() };
    localStorage.setItem(LAST_KEY, state.lastCheckedAt!);
    emit();
    return ready;
  } catch {
    state = { ...state, checking: false };
    emit();
    return false;
  }
}

/** Applies a downloaded update. Local data lives in localStorage/IndexedDB and survives. */
export async function applyAppUpdate() {
  const reg = await navigator.serviceWorker?.getRegistration();
  reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  setTimeout(() => window.location.reload(), 400);
}

let timer: number | null = null;

export function startAutoUpdates(intervalMs = 60 * 60 * 1000) {
  if (timer !== null) return;
  checkForAppUpdate().catch(() => {});
  timer = window.setInterval(() => { checkForAppUpdate().catch(() => {}); }, intervalMs);
  window.addEventListener('online', () => { checkForAppUpdate().catch(() => {}); updateBridge().catch(() => {}); });
  startBridgeAutoUpdate();
}
