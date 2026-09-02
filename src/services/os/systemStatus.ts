/**
 * Truthful system status.
 *
 * Every field here comes from a real detection call — nothing is assumed.
 * Used by the Admin AI OS tab and by the AI system prompt so TIVO can never
 * claim a capability (local model, Bridge, terminal, APK build) that is not
 * actually present in this runtime.
 */
import { idbAvailable } from './idbStore';
import { getBridgeMonitorState } from './bridgeMonitor';
import { getOllamaState } from './ollama';
import { modelRegistry } from './modelManager';
import { isLocalReady, probeRuntime } from './localRuntime';
import { constitutionRevision } from './constitution';
import { brainRevision } from './brain';
import { lastConfigReload } from './dbSync';
import { loadProviderConfigs } from '../aiRouter';

export type Readiness = 'ready' | 'not-ready' | 'partial';

export interface SubsystemStatus {
  id: string;
  label: string;
  state: Readiness;
  detail: string;
}

export interface SystemStatusReport {
  checkedAt: string;
  online: boolean;
  offlineReady: SubsystemStatus;
  localAi: SubsystemStatus;
  cloudAi: SubsystemStatus;
  bridge: SubsystemStatus;
  buildTargets: SubsystemStatus;
  config: SubsystemStatus;
  all: SubsystemStatus[];
}

/**
 * Build targets that this codebase can genuinely produce.
 * `web` is produced by `vite build` here. `apk` requires the Capacitor Android
 * project plus Android SDK/Gradle, which only exist in CI or on a dev machine —
 * so it is reported as CI-only, never as locally available.
 */
export function buildTargetAvailability() {
  return [
    { target: 'web', available: true, where: 'here + CI', detail: 'vite build produces dist/ (PWA included).' },
    { target: 'zip', available: true, where: 'here + CI', detail: 'Source/dist archive export.' },
    {
      target: 'apk', available: false, where: 'CI / local Android tooling',
      detail: 'Capacitor Android project is configured; the .apk itself must be compiled by Gradle with the Android SDK (GitHub Actions job "apk").',
    },
    {
      target: 'exe', available: false, where: 'CI / local desktop tooling',
      detail: 'No desktop packager is wired in this project yet — a web dist is NOT an .exe and is never labelled as one.',
    },
  ];
}

export async function collectSystemStatus(): Promise<SystemStatusReport> {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;

  // Offline readiness — real storage probes only.
  const idb = await idbAvailable();
  let ls = false;
  try { localStorage.setItem('tivo-probe', '1'); localStorage.removeItem('tivo-probe'); ls = true; } catch { ls = false; }
  const swReady = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    ? Boolean((await navigator.serviceWorker.getRegistration().catch(() => null)))
    : false;
  const offlineReady: SubsystemStatus = {
    id: 'offline', label: 'Offline ready',
    state: idb && ls ? (swReady ? 'ready' : 'partial') : 'not-ready',
    detail: [
      `IndexedDB ${idb ? 'available' : 'unavailable'}`,
      `localStorage ${ls ? 'available' : 'unavailable'}`,
      `service worker ${swReady ? 'registered' : 'not registered (dev/preview never registers one)'}`,
    ].join(' · '),
  };

  // Local AI — only "ready" when a runtime actually answered.
  const ollama = getOllamaState();
  const ggufReady = isLocalReady() || (await probeRuntime().catch(() => false));
  const readyModels = modelRegistry.getAll().filter((m) => m.enabled && m.status === 'ready');
  const localAi: SubsystemStatus = {
    id: 'local-ai', label: 'Local AI',
    state: ggufReady || (ollama.running && ollama.models.length > 0) ? 'ready' : 'not-ready',
    detail: ggufReady
      ? `Local GGUF runtime responding · ${readyModels.length} model(s) ready`
      : ollama.running
        ? `Ollama running with ${ollama.models.length} model(s)`
        : 'No local inference runtime detected (install the Desktop Bridge runtime or run Ollama).',
  };

  // Cloud providers — from the admin-managed provider registry, never from keys in the client.
  let providers: { enabled: boolean }[] = [];
  try { providers = await loadProviderConfigs(true); } catch { providers = []; }
  const cloudAi: SubsystemStatus = {
    id: 'cloud-ai', label: 'Cloud providers',
    state: !online ? 'not-ready' : providers.length ? 'ready' : 'partial',
    detail: !online
      ? 'Device is offline — cloud providers unreachable.'
      : providers.length
        ? `${providers.length} enabled provider config(s); keys resolve server-side only.`
        : 'No provider rows configured — the server falls back to its own configured gateway.',
  };

  const monitor = getBridgeMonitorState();
  const bridge: SubsystemStatus = {
    id: 'bridge', label: 'Desktop Bridge',
    state: monitor.state === 'connected' ? 'ready' : 'not-ready',
    detail: monitor.state === 'connected'
      ? 'Bridge responding — filesystem/terminal/input tools follow granted permissions.'
      : `Bridge ${monitor.state}. Terminal, filesystem, mouse and keyboard are NOT available until the native Bridge runs.`,
  };

  const targets = buildTargetAvailability();
  const buildTargets: SubsystemStatus = {
    id: 'build', label: 'Build targets',
    state: 'partial',
    detail: targets.map((t) => `${t.target}: ${t.available ? 'available' : 'requires ' + t.where}`).join(' · '),
  };

  const config: SubsystemStatus = {
    id: 'config', label: 'Brain / Constitution revision',
    state: 'ready',
    detail: `constitution ${constitutionRevision()} · brain ${brainRevision()} · last DB reload ${lastConfigReload() || 'never (local copy in use)'}`,
  };

  const all = [offlineReady, localAi, cloudAi, bridge, buildTargets, config];
  return { checkedAt: new Date().toISOString(), online, offlineReady, localAi, cloudAi, bridge, buildTargets, config, all };
}

/** Compact block injected into the system prompt so the AI cannot over-claim. */
export async function systemStatusPromptBlock(): Promise<string> {
  const r = await collectSystemStatus();
  return r.all.map((s) => `- ${s.label}: ${s.state} — ${s.detail}`).join('\n');
}
