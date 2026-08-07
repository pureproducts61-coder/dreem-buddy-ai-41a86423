/**
 * TIVO Desktop Bridge client.
 * The Bridge is an optional local helper (localhost) that grants TIVO real
 * control of the machine. Everything is permission-gated and fails soft:
 * when the Bridge is absent the app keeps working, just without OS control.
 */
import { LocalRegistry } from './registry';
import { recordPermissionUse } from './permissionAudit';

const ENDPOINT_KEY = 'tivo-os-bridge-endpoint';
const TOKEN_KEY = 'tivo-os-bridge-token';
const DEFAULT_ENDPOINT = 'http://127.0.0.1:8791';

export type BridgeCapability =
  | 'files.read' | 'files.write' | 'apps.launch' | 'terminal.run'
  | 'screen.capture' | 'input.control' | 'clipboard' | 'notifications'
  | 'windows.manage' | 'audio.record' | 'audio.play' | 'camera.use'
  | 'usb.access' | 'bluetooth.access' | 'serial.access' | 'network.access'
  | 'browser.control' | 'system.info';

export interface BridgePermission {
  id: string;
  [key: string]: unknown;
  capability: BridgeCapability;
  label: string;
  granted: boolean;
  scope: string;        // e.g. folder path or "*"
  grantedAt?: string;
  note?: string;
  /** where the decision came from: the user, a plugin manifest or the system */
  source?: 'user' | 'plugin' | 'system';
  lastUsedAt?: string;
  /** set when an admin/policy hard-blocks a capability regardless of grant */
  blocked?: boolean;
  /** an AI request is waiting for the user to decide */
  pending?: boolean;
}

const PERMISSION_SEED: BridgePermission[] = ([
  ['files.read', 'Read files and folders'],
  ['files.write', 'Create, edit and delete files'],
  ['apps.launch', 'Open and close applications'],
  ['terminal.run', 'Run terminal commands'],
  ['screen.capture', 'See the screen'],
  ['input.control', 'Control mouse and keyboard'],
  ['clipboard', 'Read and write the clipboard'],
  ['notifications', 'Show desktop notifications'],
  ['windows.manage', 'Move, focus and close windows'],
  ['audio.record', 'Use the microphone'],
  ['audio.play', 'Play sound through the speakers'],
  ['camera.use', 'Use the camera'],
  ['usb.access', 'Talk to USB devices'],
  ['bluetooth.access', 'Talk to Bluetooth devices'],
  ['serial.access', 'Talk to serial devices'],
  ['network.access', 'Make local network requests'],
  ['browser.control', 'Control the web browser'],
  ['system.info', 'Read system information (CPU, GPU, RAM, storage)'],
] as [BridgeCapability, string][]).map(([capability, label]) => ({
  id: capability, capability, label, granted: false, scope: '*',
}));

export const bridgePermissions = new LocalRegistry<BridgePermission>('tivo-os-bridge-permissions', PERMISSION_SEED);

/** Adds any newly shipped permission rows to an existing (older) local registry. */
export function ensureSeedPermissions() {
  const existing = new Set(bridgePermissions.getAll().map((p) => p.capability));
  const missing = PERMISSION_SEED.filter((p) => !existing.has(p.capability));
  if (missing.length) bridgePermissions.replaceAll([...bridgePermissions.getAll(), ...missing]);
}

export function isPermitted(capability: BridgeCapability): boolean {
  const p = bridgePermissions.get(capability);
  return p?.granted === true && p?.blocked !== true;
}

export type PermissionStatus = 'enabled' | 'disabled' | 'pending' | 'blocked';

export function permissionStatus(capability: BridgeCapability): PermissionStatus {
  const p = bridgePermissions.get(capability);
  if (!p) return 'disabled';
  if (p.blocked) return 'blocked';
  if (p.pending) return 'pending';
  return p.granted ? 'enabled' : 'disabled';
}

export function setPermission(
  capability: BridgeCapability,
  granted: boolean,
  scope = '*',
  source: 'user' | 'plugin' | 'system' = 'user',
) {
  bridgePermissions.update(capability, {
    granted, scope, source, pending: false,
    grantedAt: granted ? new Date().toISOString() : undefined,
  });
  recordPermissionUse({
    capability, action: granted ? 'permission.granted' : 'permission.revoked',
    allowed: granted, reason: `Changed by ${source}`, source: source === 'user' ? 'user' : 'system',
  });
}

/** Mark that the AI is waiting for the user to decide on a capability. */
export function requestPermission(capability: BridgeCapability, reason: string) {
  bridgePermissions.update(capability, { pending: true });
  recordPermissionUse({ capability, action: 'permission.requested', allowed: false, reason });
}

export function getEndpoint(): string {
  return localStorage.getItem(ENDPOINT_KEY) || DEFAULT_ENDPOINT;
}
export function setEndpoint(url: string) {
  localStorage.setItem(ENDPOINT_KEY, url.replace(/\/$/, ''));
}
export function getPairToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}
export function setPairToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export interface BridgeHealth {
  online: boolean;
  version?: string;
  os?: string;
  latencyMs?: number;
  capabilities?: BridgeCapability[];
  error?: string;
  checkedAt: string;
}

let lastHealth: BridgeHealth = { online: false, checkedAt: new Date(0).toISOString() };
export function getLastHealth() { return lastHealth; }

export async function pingBridge(timeoutMs = 2500): Promise<BridgeHealth> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${getEndpoint()}/health`, {
      signal: controller.signal,
      headers: getPairToken() ? { Authorization: `Bearer ${getPairToken()}` } : undefined,
    });
    if (!res.ok) throw new Error(`Bridge responded ${res.status}`);
    const body = await res.json().catch(() => ({}));
    lastHealth = {
      online: true,
      version: body.version,
      os: body.os,
      capabilities: body.capabilities,
      latencyMs: Math.round(performance.now() - started),
      checkedAt: new Date().toISOString(),
    };
  } catch (e) {
    lastHealth = {
      online: false,
      error: e instanceof Error && e.name === 'AbortError' ? 'No response from the Desktop Bridge' : 'Desktop Bridge is not running',
      checkedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
  return lastHealth;
}

export class BridgeUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = 'BridgeUnavailableError'; }
}

/** Invoke a Bridge action. Throws a human-readable error when blocked. */
export async function bridgeCall<T = unknown>(
  capability: BridgeCapability,
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  if (!isPermitted(capability)) {
    requestPermission(capability, `Needed for "${action}"`);
    throw new BridgeUnavailableError(
      `I need your permission for "${bridgePermissions.get(capability)?.label || capability}" before I can do that.`,
    );
  }
  const health = await pingBridge();
  if (!health.online) {
    recordPermissionUse({ capability, action, allowed: false, reason: 'Desktop Bridge is not running' });
    throw new BridgeUnavailableError(
      'The Desktop Bridge is not running on this computer, so I cannot control it right now.',
    );
  }
  bridgePermissions.update(capability, { lastUsedAt: new Date().toISOString() });
  recordPermissionUse({ capability, action, allowed: true, reason: `AI executed "${action}"` });
  const res = await fetch(`${getEndpoint()}/action/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(getPairToken() ? { Authorization: `Bearer ${getPairToken()}` } : {}),
    },
    body: JSON.stringify({ capability, payload }),
  });
  if (!res.ok) throw new Error(`The Bridge could not complete "${action}".`);
  return res.json() as Promise<T>;
}

/* ---------------- device pairing ---------------- */

export interface PairedDevice {
  id: string;
  [key: string]: unknown;
  name: string;
  platform: string;
  endpoint: string;
  pairedAt: string;
  lastSeenAt?: string;
}

export const pairedDevices = new LocalRegistry<PairedDevice>('tivo-os-paired-devices', []);

export function generatePairCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase().match(/.{1,4}/g)!.join('-');
}

export function pairDevice(name: string, platform: string, endpoint: string, token: string): PairedDevice {
  setEndpoint(endpoint);
  setPairToken(token);
  return pairedDevices.add({
    name, platform, endpoint, pairedAt: new Date().toISOString(),
  } as Omit<PairedDevice, 'id'>);
}