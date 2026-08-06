/**
 * Desktop Bridge lifecycle: detect → install → register service → pair → verify → update.
 * The browser cannot execute an installer itself, so the flow downloads the signed
 * installer, then autonomously finishes every remaining step the moment the Bridge
 * answers on localhost (service + startup registration, pairing, permissions, verify).
 */
import {
  bridgeCall, ensureSeedPermissions, getEndpoint, getPairToken, pairDevice,
  pingBridge, setPairToken, type BridgeHealth,
} from './desktopBridge';

const MANIFEST_KEY = 'tivo-os-bridge-manifest-url';
const CHANNEL_KEY = 'tivo-os-bridge-channel';
const INSTALLED_KEY = 'tivo-os-bridge-installed-version';
const DEFAULT_MANIFEST = 'https://tivo-ai-os.lovable.app/bridge/manifest.json';

export type InstallStepId =
  | 'detect' | 'download' | 'install' | 'service' | 'startup'
  | 'permissions' | 'verify' | 'pair' | 'ready';

export interface InstallStep {
  id: InstallStepId;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  detail?: string;
}

export interface BridgeRelease {
  version: string;
  channel: string;
  notes?: string;
  files?: { path: string; sha256?: string; size?: number; url: string }[];
  installers: Record<string, string>; // platform -> url
}

export const getManifestUrl = () => localStorage.getItem(MANIFEST_KEY) || DEFAULT_MANIFEST;
export const setManifestUrl = (url: string) => localStorage.setItem(MANIFEST_KEY, url);
export const getChannel = () => localStorage.getItem(CHANNEL_KEY) || 'stable';
export const setChannel = (c: string) => localStorage.setItem(CHANNEL_KEY, c);
export const getInstalledVersion = () => localStorage.getItem(INSTALLED_KEY) || '';

export function detectPlatform(): 'windows' | 'macos' | 'linux' | 'mobile' | 'unknown' {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
  if (/Win/i.test(ua)) return 'windows';
  if (/Mac/i.test(ua)) return 'macos';
  if (/Linux|X11/i.test(ua)) return 'linux';
  return 'unknown';
}

export function isInstalledPwa(): boolean {
  return window.matchMedia?.('(display-mode: standalone)')?.matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export async function fetchRelease(): Promise<BridgeRelease | null> {
  try {
    const res = await fetch(`${getManifestUrl()}?channel=${encodeURIComponent(getChannel())}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as BridgeRelease;
  } catch {
    return null;
  }
}

export interface BridgeStatus {
  health: BridgeHealth;
  platform: ReturnType<typeof detectPlatform>;
  installedVersion: string;
  latest: BridgeRelease | null;
  updateAvailable: boolean;
  installerUrl: string;
}

export async function checkBridgeStatus(): Promise<BridgeStatus> {
  const [health, latest] = await Promise.all([pingBridge(), fetchRelease()]);
  const installedVersion = health.version || getInstalledVersion();
  if (health.version) localStorage.setItem(INSTALLED_KEY, health.version);
  const platform = detectPlatform();
  return {
    health, platform, installedVersion, latest,
    updateAvailable: Boolean(latest?.version && installedVersion && latest.version !== installedVersion),
    installerUrl: latest?.installers?.[platform] || '',
  };
}

const baseSteps = (): InstallStep[] => ([
  { id: 'detect', label: 'Looking for the Bridge on this computer', status: 'pending' },
  { id: 'download', label: 'Downloading the Bridge installer', status: 'pending' },
  { id: 'install', label: 'Waiting for the installer to finish', status: 'pending' },
  { id: 'service', label: 'Registering the local service', status: 'pending' },
  { id: 'startup', label: 'Enabling start with the computer', status: 'pending' },
  { id: 'permissions', label: 'Registering permissions', status: 'pending' },
  { id: 'verify', label: 'Verifying the installation', status: 'pending' },
  { id: 'pair', label: 'Pairing with your account', status: 'pending' },
  { id: 'ready', label: 'Bridge ready', status: 'pending' },
]);

type Emit = (steps: InstallStep[]) => void;

/**
 * Runs the full install/repair flow. Safe to re-run: already-satisfied steps are skipped.
 */
export async function installBridge(onStep: Emit, opts: { accountId?: string } = {}): Promise<boolean> {
  const steps = baseSteps();
  const set = (id: InstallStepId, patch: Partial<InstallStep>) => {
    const s = steps.find((x) => x.id === id)!;
    Object.assign(s, patch);
    onStep([...steps]);
  };

  set('detect', { status: 'running' });
  let health = await pingBridge();
  if (health.online) {
    set('detect', { status: 'done', detail: `Already running (${health.version || 'unknown version'})` });
    set('download', { status: 'skipped' });
    set('install', { status: 'skipped' });
  } else {
    set('detect', { status: 'done', detail: 'Not installed yet' });
    const status = await checkBridgeStatus();
    if (!status.installerUrl) {
      set('download', { status: 'failed', detail: 'No installer is published for this platform yet' });
      return false;
    }
    set('download', { status: 'running' });
    try {
      const a = document.createElement('a');
      a.href = status.installerUrl;
      a.download = '';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      set('download', { status: 'done', detail: `v${status.latest?.version || ''} for ${status.platform}` });
    } catch {
      set('download', { status: 'failed', detail: 'Could not start the download' });
      return false;
    }
    set('install', { status: 'running', detail: 'Approve the installer, this finishes by itself' });
    health = await waitForBridge(300_000, (left) => set('install', {
      status: 'running', detail: `Waiting for the Bridge… ${Math.round(left / 1000)}s`,
    }));
    if (!health.online) {
      set('install', { status: 'failed', detail: 'The Bridge did not start. Run the downloaded installer and try again.' });
      return false;
    }
    set('install', { status: 'done' });
  }

  await safeStep(set, 'service', () => bridgeCall('system.info', 'service.register', { app: 'tivo-ai-os' }));
  await safeStep(set, 'startup', () => bridgeCall('system.info', 'service.autostart', { enabled: true }));

  set('permissions', { status: 'running' });
  ensureSeedPermissions();
  set('permissions', { status: 'done', detail: 'Every permission is off until you switch it on' });

  set('verify', { status: 'running' });
  const verify = await pingBridge();
  if (!verify.online) {
    set('verify', { status: 'failed', detail: 'The Bridge stopped responding' });
    return false;
  }
  if (verify.version) localStorage.setItem(INSTALLED_KEY, verify.version);
  set('verify', { status: 'done', detail: `${verify.version || 'ok'} · ${verify.latencyMs}ms` });

  set('pair', { status: 'running' });
  try {
    const res = await bridgeCall<{ token?: string }>('system.info', 'pair.begin', {
      account: opts.accountId || 'local-user',
      app: 'TIVO AI OS',
    }).catch(() => ({ token: undefined }));
    if (res?.token) setPairToken(res.token);
    pairDevice(verify.os || 'This computer', verify.os || detectPlatform(), getEndpoint(), getPairToken());
    set('pair', { status: 'done', detail: 'Paired with this account' });
  } catch {
    set('pair', { status: 'failed', detail: 'Pairing failed — open the Bridge app and approve this device' });
    return false;
  }

  set('ready', { status: 'done', detail: 'The Bridge is part of the system now' });
  return true;
}

async function safeStep(
  set: (id: InstallStepId, p: Partial<InstallStep>) => void,
  id: InstallStepId,
  fn: () => Promise<unknown>,
) {
  set(id, { status: 'running' });
  try {
    await fn();
    set(id, { status: 'done' });
  } catch {
    set(id, { status: 'skipped', detail: 'This Bridge version handles it automatically' });
  }
}

export async function waitForBridge(timeoutMs: number, onTick?: (msLeft: number) => void): Promise<BridgeHealth> {
  const deadline = Date.now() + timeoutMs;
  let health = await pingBridge();
  while (!health.online && Date.now() < deadline) {
    onTick?.(deadline - Date.now());
    await new Promise((r) => setTimeout(r, 3000));
    health = await pingBridge();
  }
  return health;
}

/** Delta update: only changed files are pulled, user data is never touched. */
export async function updateBridge(onStep?: (msg: string) => void): Promise<{ updated: boolean; message: string }> {
  const status = await checkBridgeStatus();
  if (!status.health.online) return { updated: false, message: 'The Bridge is not running.' };
  if (!status.latest) return { updated: false, message: 'Could not reach the update server.' };
  if (!status.updateAvailable) return { updated: false, message: `Bridge is up to date (${status.installedVersion}).` };

  onStep?.(`Updating Bridge to ${status.latest.version}…`);
  try {
    await bridgeCall('system.info', 'update.apply', {
      version: status.latest.version,
      files: status.latest.files || [],
      deltaOnly: true,
    });
    const health = await waitForBridge(120_000);
    if (health.version) localStorage.setItem(INSTALLED_KEY, health.version);
    return { updated: true, message: `Bridge updated to ${health.version || status.latest.version}.` };
  } catch {
    return { updated: false, message: 'The Bridge refused the update. It will retry on the next launch.' };
  }
}

let autoTimer: number | null = null;

/** Background watcher: keeps the Bridge current without the user ever reinstalling. */
export function startBridgeAutoUpdate(intervalMs = 6 * 60 * 60 * 1000) {
  if (autoTimer !== null) return;
  const run = () => { updateBridge().catch(() => {}); };
  run();
  autoTimer = window.setInterval(run, intervalMs);
}
