/**
 * Capability Registry — automatic detection of what this device can actually do.
 * Every capability is dynamic: detection runs on demand and the result feeds
 * both the Admin UI and the AI system prompt (so TIVO never claims an ability
 * it does not have).
 */
import { pingBridge, bridgePermissions, isPermitted, type BridgeCapability } from './desktopBridge';
import { detectHardware } from './modelManager';
import { enabledPlugins } from './plugins';

export type CapabilityState = 'ready' | 'unavailable' | 'permission-required' | 'plugin-required' | 'disabled';

export interface CapabilityInfo {
  id: string;
  label: string;
  state: CapabilityState;
  detail: string;
  health: 'good' | 'degraded' | 'down';
  lastUsedAt?: string;
  checkedAt: string;
}

const LAST_USED_KEY = 'tivo-os-capability-usage';

function lastUsedMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LAST_USED_KEY) || '{}'); } catch { return {}; }
}

export function markCapabilityUsed(id: string) {
  const map = lastUsedMap();
  map[id] = new Date().toISOString();
  localStorage.setItem(LAST_USED_KEY, JSON.stringify(map));
}

let cache: CapabilityInfo[] = [];
const listeners = new Set<() => void>();
export const subscribeCapabilities = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getCapabilities = () => cache;

function bridgeBacked(id: string, label: string, cap: BridgeCapability, online: boolean): CapabilityInfo {
  const perm = bridgePermissions.get(cap);
  const state: CapabilityState = !online ? 'unavailable'
    : perm && perm.enabled === false ? 'disabled'
    : isPermitted(cap) ? 'ready' : 'permission-required';
  return {
    id, label, state,
    detail: state === 'ready' ? 'Ready through the Desktop Bridge'
      : state === 'permission-required' ? 'Waiting for your permission'
      : state === 'disabled' ? 'Turned off in the Bridge permissions'
      : 'The Desktop Bridge is not running',
    health: state === 'ready' ? 'good' : state === 'unavailable' ? 'down' : 'degraded',
    checkedAt: new Date().toISOString(),
  };
}

export async function detectCapabilities(): Promise<CapabilityInfo[]> {
  const now = new Date().toISOString();
  const health = await pingBridge().catch(() => ({ online: false } as { online: boolean }));
  const online = Boolean(health.online);
  const hw = await detectHardware();
  const plugins = enabledPlugins();
  const list: CapabilityInfo[] = [];

  list.push({
    id: 'desktop-bridge', label: 'Desktop Bridge',
    state: online ? 'ready' : 'unavailable',
    detail: online ? 'Connected to this computer' : 'Local helper is not running',
    health: online ? 'good' : 'down', checkedAt: now,
  });

  const media = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  list.push({
    id: 'vision', label: 'Computer Vision',
    state: online ? (isPermitted('screen.capture') ? 'ready' : 'permission-required') : media ? 'permission-required' : 'unavailable',
    detail: online ? 'Screen capture through the Bridge' : 'Browser screen sharing only',
    health: online ? 'good' : 'degraded', checkedAt: now,
  });

  list.push(bridgeBacked('filesystem', 'Filesystem', 'files.read', online));
  list.push(bridgeBacked('mouse', 'Mouse control', 'input.control', online));
  list.push(bridgeBacked('keyboard', 'Keyboard control', 'input.control', online));
  list.push(bridgeBacked('terminal', 'Terminal', 'terminal.run', online));
  list.push(bridgeBacked('apps', 'Installed applications', 'apps.launch', online));

  const clip = typeof navigator !== 'undefined' && !!navigator.clipboard;
  list.push({
    id: 'clipboard', label: 'Clipboard',
    state: clip ? 'ready' : online ? 'permission-required' : 'unavailable',
    detail: clip ? 'Browser clipboard is available' : 'Needs the Bridge',
    health: clip ? 'good' : 'degraded', checkedAt: now,
  });

  list.push({
    id: 'browser', label: 'Browser automation',
    state: plugins.some((p) => p.kind === 'connector' || /browser/i.test(p.name)) ? 'ready' : 'plugin-required',
    detail: 'Provided by a browser-automation plugin', health: 'degraded', checkedAt: now,
  });

  for (const [id, label] of [['microphone', 'Microphone'], ['camera', 'Camera']] as const) {
    list.push({
      id, label,
      state: media ? 'permission-required' : 'unavailable',
      detail: media ? 'Ask the browser when needed' : 'Not supported on this device',
      health: media ? 'degraded' : 'down', checkedAt: now,
    });
  }

  list.push({ id: 'gpu', label: 'GPU', state: hw.gpu && hw.gpu !== 'unknown' ? 'ready' : 'unavailable', detail: hw.gpu || 'unknown', health: 'good', checkedAt: now });
  list.push({ id: 'cpu', label: 'CPU', state: 'ready', detail: `${hw.cores} logical cores`, health: 'good', checkedAt: now });
  list.push({ id: 'ram', label: 'Memory', state: 'ready', detail: `${hw.ramGb} GB reported`, health: hw.ramGb >= 4 ? 'good' : 'degraded', checkedAt: now });
  list.push({
    id: 'network', label: 'Network',
    state: navigator.onLine ? 'ready' : 'unavailable',
    detail: navigator.onLine ? 'Online' : 'Offline — local engines only',
    health: navigator.onLine ? 'good' : 'degraded', checkedAt: now,
  });

  const used = lastUsedMap();
  cache = list.map((c) => ({ ...c, lastUsedAt: used[c.id] }));
  listeners.forEach((l) => l());
  return cache;
}

/** Compact block injected into the system prompt so the AI knows its real limits. */
export function capabilitiesPromptBlock(): string {
  if (!cache.length) return '';
  return cache.map((c) => `- ${c.label}: ${c.state}${c.detail ? ` (${c.detail})` : ''}`).join('\n');
}