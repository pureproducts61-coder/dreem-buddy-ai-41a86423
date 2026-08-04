/**
 * TIVO Desktop Bridge client.
 * The Bridge is an optional local helper (localhost) that grants TIVO real
 * control of the machine. Everything is permission-gated and fails soft:
 * when the Bridge is absent the app keeps working, just without OS control.
 */
import { LocalRegistry } from './registry';

const ENDPOINT_KEY = 'tivo-os-bridge-endpoint';
const TOKEN_KEY = 'tivo-os-bridge-token';
const DEFAULT_ENDPOINT = 'http://127.0.0.1:8791';

export type BridgeCapability =
  | 'files.read' | 'files.write' | 'apps.launch' | 'terminal.run'
  | 'screen.capture' | 'input.control' | 'clipboard' | 'notifications';

export interface BridgePermission {
  id: string;
  [key: string]: unknown;
  capability: BridgeCapability;
  label: string;
  granted: boolean;
  scope: string;        // e.g. folder path or "*"
  grantedAt?: string;
  note?: string;
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
] as [BridgeCapability, string][]).map(([capability, label]) => ({
  id: capability, capability, label, granted: false, scope: '*',
}));

export const bridgePermissions = new LocalRegistry<BridgePermission>('tivo-os-bridge-permissions', PERMISSION_SEED);

export function isPermitted(capability: BridgeCapability): boolean {
  return bridgePermissions.get(capability)?.granted === true;
}

export function setPermission(capability: BridgeCapability, granted: boolean, scope = '*') {
  bridgePermissions.update(capability, { granted, scope, grantedAt: granted ? new Date().toISOString() : undefined });
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
    throw new BridgeUnavailableError(
      `I need your permission for "${bridgePermissions.get(capability)?.label || capability}" before I can do that.`,
    );
  }
  const health = await pingBridge();
  if (!health.online) {
    throw new BridgeUnavailableError(
      'The Desktop Bridge is not running on this computer, so I cannot control it right now.',
    );
  }
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