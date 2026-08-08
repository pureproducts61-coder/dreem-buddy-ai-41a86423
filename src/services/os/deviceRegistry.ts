/**
 * Multi-device registry.
 * Every TIVO install (phone, computer) gets a stable device identity tied to
 * the signed-in account, publishes a heartbeat with its real capabilities and
 * is marked offline when the heartbeat stops. Works offline: the identity and
 * the last known device list live locally and sync when the network returns.
 */
import { supabase } from '@/integrations/supabase/client';
import { detectCapabilities, getCapabilities } from './capabilities';
import { getBridgeMonitorState } from './bridgeMonitor';
import { modelRegistry } from './modelManager';
import { bridgePermissions } from './desktopBridge';

const ID_KEY = 'tivo-os-device-id';
const NAME_KEY = 'tivo-os-device-name';
const CACHE_KEY = 'tivo-os-device-cache';
const HEARTBEAT_MS = 30_000;
const OFFLINE_AFTER_MS = 90_000;

export interface DeviceRow {
  device_id: string;
  name: string;
  platform: string | null;
  role: string;
  online: boolean;
  health: string;
  bridge_state: unknown;
  capabilities: { id: string; label: string; state: string }[];
  models: { name: string; status: string }[];
  permissions: { capability: string; granted: boolean }[];
  last_heartbeat: string;
}

export function deviceId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(ID_KEY, id); }
  return id;
}

function guessPlatform(): string {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/windows/i.test(ua)) return 'Windows';
  if (/mac os/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}

export function isMobileDevice(): boolean {
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

export function deviceName(): string {
  return localStorage.getItem(NAME_KEY) || `${guessPlatform()} ${isMobileDevice() ? 'phone' : 'computer'}`;
}
export function setDeviceName(name: string) { localStorage.setItem(NAME_KEY, name); }

/** Role decides what this device is good for: a phone commands, a computer executes. */
export function deviceRole(): 'mobile' | 'desktop' {
  return isMobileDevice() ? 'mobile' : 'desktop';
}

const listeners = new Set<() => void>();
export const subscribeDevices = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

let devices: DeviceRow[] = (() => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); } catch { return []; }
})();
export const getDevices = () => devices;

function publish(list: DeviceRow[]) {
  const now = Date.now();
  devices = list.map((d) => ({
    ...d,
    online: d.online && now - new Date(d.last_heartbeat).getTime() < OFFLINE_AFTER_MS,
  }));
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(devices)); } catch { /* quota */ }
  listeners.forEach((l) => l());
}

async function currentUserId(): Promise<string | null> {
  try { return (await supabase.auth.getUser()).data.user?.id ?? null; } catch { return null; }
}

/** Snapshot of this device's real state — never invented, always from the registries. */
function snapshot() {
  const bridge = getBridgeMonitorState();
  const caps = getCapabilities();
  return {
    capabilities: caps.map((c) => ({ id: c.id, label: c.label, state: c.state })),
    models: modelRegistry.getAll().filter((m) => m.enabled).map((m) => ({ name: m.name, status: m.status })),
    permissions: bridgePermissions.getAll().map((p) => ({ capability: p.capability, granted: p.granted })),
    bridge_state: { state: bridge.state, lastConnectedAt: bridge.lastConnectedAt, transport: bridge.transport },
    health: caps.some((c) => c.health === 'down') ? 'degraded' : 'good',
  };
}

export async function heartbeat(online = true) {
  const uid = await currentUserId();
  if (!uid) return;
  await detectCapabilities().catch(() => {});
  const s = snapshot();
  await supabase.from('user_devices').upsert({
    user_id: uid,
    device_id: deviceId(),
    name: deviceName(),
    platform: guessPlatform(),
    role: deviceRole(),
    online,
    last_heartbeat: new Date().toISOString(),
    ...s,
  } as never, { onConflict: 'user_id,device_id' }).then(() => undefined, () => undefined);
  await refreshDevices();
}

export async function refreshDevices() {
  const uid = await currentUserId();
  if (!uid) return;
  const { data } = await supabase
    .from('user_devices')
    .select('device_id,name,platform,role,online,health,bridge_state,capabilities,models,permissions,last_heartbeat')
    .eq('user_id', uid);
  if (data) publish(data as unknown as DeviceRow[]);
}

/** Best device for a capability: this device first, then a connected computer. */
export function selectDeviceFor(capabilityId: string): DeviceRow | null {
  const me = deviceId();
  const ready = devices.filter((d) => d.online && d.capabilities?.some((c) => c.id === capabilityId && c.state === 'ready'));
  return ready.find((d) => d.device_id === me)
    || ready.find((d) => d.role === 'desktop')
    || ready[0]
    || null;
}

let started = false;
export async function startDeviceRuntime() {
  if (started) return;
  started = true;
  await heartbeat().catch(() => {});
  setInterval(() => { void heartbeat().catch(() => {}); }, HEARTBEAT_MS);

  try {
    const uid = await currentUserId();
    if (uid) {
      supabase.channel(`devices-${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_devices', filter: `user_id=eq.${uid}` },
          () => { void refreshDevices(); })
        .subscribe();
    }
  } catch { /* realtime unavailable — polling still works */ }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { void heartbeat(); });
    window.addEventListener('pagehide', () => { void heartbeat(false); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void heartbeat();
    });
  }
}