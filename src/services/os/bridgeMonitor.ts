/**
 * Desktop Bridge health monitor.
 * Keeps a heartbeat against the local Bridge, detects disconnects and stale
 * heartbeats, reconnects with exponential backoff and publishes a single live
 * state that the existing Desktop Bridge panel renders.
 */
import { pingBridge, getEndpoint, type BridgeHealth } from './desktopBridge';
import { reportRuntimeCapability } from './capabilities';

export type BridgeConnectionState = 'connected' | 'connecting' | 'stale' | 'disconnected';

export interface BridgeMonitorState {
  state: BridgeConnectionState;
  health: BridgeHealth | null;
  transport: string;
  endpoint: string;
  lastConnectedAt: string | null;
  lastHeartbeatAt: string | null;
  attempts: number;
  nextRetryInMs: number;
  paused: boolean;
  message: string;
}

const HEARTBEAT_MS = 10_000;
const STALE_AFTER_MS = 45_000;
const MAX_BACKOFF_MS = 60_000;
/** stop hammering a Bridge that has clearly never been installed */
const MAX_COLD_ATTEMPTS = 30;

let state: BridgeMonitorState = {
  state: 'disconnected',
  health: null,
  transport: 'http/localhost',
  endpoint: getEndpoint(),
  lastConnectedAt: null,
  lastHeartbeatAt: null,
  attempts: 0,
  nextRetryInMs: HEARTBEAT_MS,
  paused: false,
  message: 'Looking for the Desktop Bridge…',
};

const listeners = new Set<() => void>();
export const subscribeBridgeMonitor = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getBridgeMonitorState = () => state;
const emit = () => listeners.forEach((l) => l());

function set(patch: Partial<BridgeMonitorState>) {
  state = { ...state, ...patch, endpoint: getEndpoint() };
  emit();
}

let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

async function beat() {
  if (state.paused) return schedule(HEARTBEAT_MS);
  const health = await pingBridge().catch(() => null);
  const now = new Date().toISOString();

  if (health?.online) {
    set({
      state: 'connected', health, attempts: 0, nextRetryInMs: HEARTBEAT_MS,
      lastConnectedAt: now, lastHeartbeatAt: now,
      message: `Connected to ${health.os || 'this computer'}${health.version ? ` (Bridge ${health.version})` : ''}`,
    });
    reportRuntimeCapability({
      id: 'desktop-bridge', label: 'Desktop Bridge', state: 'ready', health: 'good',
      detail: `Connected · ${health.latencyMs ?? '?'}ms`,
    });
    return schedule(HEARTBEAT_MS);
  }

  const attempts = state.attempts + 1;
  const lastBeat = state.lastHeartbeatAt ? Date.now() - new Date(state.lastHeartbeatAt).getTime() : Infinity;
  const wasConnected = state.lastConnectedAt !== null;
  const stale = wasConnected && lastBeat < STALE_AFTER_MS;
  const paused = !wasConnected && attempts >= MAX_COLD_ATTEMPTS;
  const backoff = Math.min(HEARTBEAT_MS * 2 ** Math.min(attempts, 6), MAX_BACKOFF_MS);

  set({
    state: stale ? 'stale' : paused ? 'disconnected' : wasConnected ? 'connecting' : 'disconnected',
    health: health ?? state.health,
    attempts, paused, nextRetryInMs: backoff,
    message: paused
      ? 'The Desktop Bridge is not installed or not running. Start it, then press Retry.'
      : stale
        ? 'The computer stopped answering — trying to reconnect…'
        : wasConnected ? 'Reconnecting to your computer…' : 'The Desktop Bridge is not running.',
  });
  reportRuntimeCapability({
    id: 'desktop-bridge', label: 'Desktop Bridge',
    state: 'unavailable', health: stale ? 'degraded' : 'down',
    detail: state.message,
  });
  schedule(paused ? MAX_BACKOFF_MS * 5 : backoff);
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { void beat(); }, ms);
}

/** Manual retry from the UI: clears backoff and pings immediately. */
export function retryBridgeNow() {
  set({ attempts: 0, paused: false, message: 'Checking the Desktop Bridge…', state: 'connecting' });
  void beat();
}

export function startBridgeMonitor() {
  if (started) return;
  started = true;
  void beat();
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => retryBridgeNow());
    window.addEventListener('focus', () => { if (state.state !== 'connected') retryBridgeNow(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && state.state !== 'connected') retryBridgeNow();
    });
  }
}