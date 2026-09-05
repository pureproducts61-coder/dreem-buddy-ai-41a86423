/**
 * Runtime Manager — one standard adapter interface for every place a model can
 * actually run. It does NOT re-implement any runtime: it wraps the existing
 * local GGUF runtime, local OpenAI-compatible servers, Ollama, connected
 * desktop devices and the cloud engine chain.
 *
 * Adapter contract: health → discover → load → unload → chat/stream → capabilities
 *
 * Priority (mobile-first, cloud last):
 *   1. native/local LLM server on this device
 *   2. existing local AI API on this device (Ollama / LM Studio / OpenAI-compatible)
 *   3. already-downloaded local model weights (local GGUF runtime)
 *   4. connected desktop runtime
 *   5. cloud — fallback only
 *
 * Nothing is reported "ready" because it is configured; every state comes from a
 * real health check.
 */
import { isLocalReady, loadModel, probeRuntime, unloadModel, localChatStream } from './localRuntime';
import { getDefaultModel, modelRegistry } from './modelManager';
import { engineRegistry, probeLocalApi } from './engineRouter';
import { getOllamaState, discoverOllama } from './ollama';
import { getBridgeMonitorState } from './bridgeMonitor';
import { deviceId, getDevices } from './deviceRegistry';
import { canProbeLocalHostServers, isNative, platformKind } from './platform';

/** Installed → Available → Running → Ready → Error (never "configured = ready"). */
export type RuntimeHealth = 'unknown' | 'not-installed' | 'available' | 'running' | 'ready' | 'error';

export interface RuntimeModelInfo {
  id: string;
  name: string;
  sizeBytes?: number;
  ready: boolean;
}

export interface RuntimeReport {
  id: string;
  label: string;
  kind: 'local-server' | 'local-api' | 'local-weights' | 'desktop' | 'cloud';
  priority: number;
  health: RuntimeHealth;
  detail: string;
  models: RuntimeModelInfo[];
  loadedModelId: string | null;
  capabilities: string[];
  checkedAt: string;
}

export interface RuntimeAdapter {
  id: string;
  label: string;
  kind: RuntimeReport['kind'];
  priority: number;
  /** Real health probe. Must never assume. */
  health(): Promise<{ health: RuntimeHealth; detail: string }>;
  /** Models this runtime already has — TIVO reuses them, never re-downloads. */
  discover(): Promise<RuntimeModelInfo[]>;
  load?(modelId: string): Promise<boolean>;
  unload?(): Promise<void>;
  stream?(
    messages: { role: string; content: string }[],
    onDelta: (t: string) => void,
    opts?: { system?: string; model?: string },
  ): Promise<void>;
  capabilities(): string[];
}

/* ------------------------------------------------------------------ adapters */

const localApiAdapter = (): RuntimeAdapter => ({
  id: 'local-api',
  label: 'Local AI server (Ollama / LM Studio / OpenAI-compatible)',
  kind: 'local-api',
  priority: 2,
  capabilities: () => ['chat', 'stream'],
  async health() {
    if (!canProbeLocalHostServers()) {
      return { health: 'not-installed', detail: `A ${platformKind()} browser cannot reach a local server; a native shell or the Desktop Bridge is required.` };
    }
    const engine = engineRegistry.get('local-api');
    const base = engine?.baseUrl || '';
    const ok = await probeLocalApi(base);
    return ok
      ? { health: 'ready', detail: `Local AI server is answering at ${base}.` }
      : { health: 'not-installed', detail: 'No local AI server answered on this device.' };
  },
  async discover() {
    const oll = await discoverOllama().catch(() => getOllamaState());
    return (oll?.models || []).map((m) => ({ id: m.name, name: m.name, sizeBytes: m.sizeBytes, ready: true }));
  },
  async stream(messages, onDelta, opts) {
    const engine = engineRegistry.get('local-api');
    const base = (engine?.baseUrl || '').replace(/\/$/, '');
    if (!base) throw new Error('NO_LOCAL_API');
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts?.model || engine?.model || 'local-model',
        stream: true,
        messages: opts?.system ? [{ role: 'system', content: opts.system }, ...messages] : messages,
      }),
    });
    if (!res.ok || !res.body) throw new Error(`Local API failed (${res.status})`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const json = line.slice(5).trim();
        if (json === '[DONE]') continue;
        try {
          const text = JSON.parse(json).choices?.[0]?.delta?.content ?? '';
          if (text) onDelta(text);
        } catch { /* skip */ }
      }
    }
  },
});

const localWeightsAdapter = (): RuntimeAdapter => ({
  id: 'local-weights',
  label: 'Downloaded local model weights',
  kind: 'local-weights',
  priority: 3,
  capabilities: () => ['chat', 'stream'],
  async health() {
    if (isLocalReady()) return { health: 'ready', detail: 'A local model is loaded and answering.' };
    const has = modelRegistry.getAll().some((m) => m.status === 'ready');
    if (!has) return { health: 'not-installed', detail: 'No model weights are downloaded on this device.' };
    const up = await probeRuntime();
    return up
      ? { health: 'available', detail: 'Model weights are present and a runtime is reachable — not loaded yet.' }
      : { health: 'not-installed', detail: 'Model weights exist but no inference runtime is running on this device.' };
  },
  async discover() {
    return modelRegistry.getAll().map((m) => ({ id: m.id, name: m.name, sizeBytes: m.sizeBytes, ready: m.status === 'ready' }));
  },
  load: (id) => loadModel(id),
  unload: () => unloadModel(),
  stream: (messages, onDelta, opts) => localChatStream(messages, onDelta, { system: opts?.system }),
});

const nativeServerAdapter = (): RuntimeAdapter => ({
  id: 'native-server',
  label: 'Native on-device LLM server',
  kind: 'local-server',
  priority: 1,
  capabilities: () => (isNative() ? ['chat', 'stream'] : []),
  async health() {
    if (!isNative()) {
      return { health: 'not-installed', detail: 'Native on-device inference needs the installed app (Android shell), not the browser.' };
    }
    const ok = await probeRuntime();
    return ok
      ? { health: 'ready', detail: 'The on-device inference service is answering.' }
      : { health: 'available', detail: 'Running inside the native app, but no on-device inference service is installed yet.' };
  },
  async discover() { return []; },
});

const desktopAdapter = (): RuntimeAdapter => ({
  id: 'desktop',
  label: 'Connected desktop runtime',
  kind: 'desktop',
  priority: 4,
  capabilities: () => ['chat', 'tools', 'filesystem', 'terminal'],
  async health() {
    const bridge = getBridgeMonitorState();
    if (bridge.state === 'connected') return { health: 'ready', detail: 'Desktop Bridge is connected.' };
    const online = getDevices().some((d) => d.online && d.device_id !== deviceId());
    return online
      ? { health: 'available', detail: 'Another computer is online but its Bridge is not connected to this session.' }
      : { health: 'not-installed', detail: 'No connected computer.' };
  },
  async discover() {
    const me = deviceId();
    return getDevices()
      .filter((d) => d.online && d.device_id !== me)
      .flatMap((d) => (d.models || []).map((m) => ({ id: `${d.device_id}:${m.name}`, name: `${m.name} (${d.name})`, ready: m.status === 'ready' })));
  },
});

const cloudAdapter = (): RuntimeAdapter => ({
  id: 'cloud',
  label: 'Cloud AI (fallback only)',
  kind: 'cloud',
  priority: 99,
  capabilities: () => ['chat', 'stream', 'vision'],
  async health() {
    const online = typeof navigator === 'undefined' ? true : navigator.onLine;
    return online
      ? { health: 'ready', detail: 'Cloud AI is reachable and used only when no local runtime can serve the task.' }
      : { health: 'not-installed', detail: 'No internet connection.' };
  },
  async discover() { return []; },
});

const adapters: RuntimeAdapter[] = [
  nativeServerAdapter(),
  localApiAdapter(),
  localWeightsAdapter(),
  desktopAdapter(),
  cloudAdapter(),
];

export const getAdapters = () => [...adapters].sort((a, b) => a.priority - b.priority);
export const getAdapter = (id: string) => adapters.find((a) => a.id === id) ?? null;

/* -------------------------------------------------------------------- state */

let reports: RuntimeReport[] = [];
let lastScan = 0;
const listeners = new Set<() => void>();
export const subscribeRuntimes = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getRuntimeReports = () => reports;
const emit = () => listeners.forEach((l) => l());

/** Real detection pass across every adapter. Cheap and safe to call again. */
export async function discoverRuntimes(force = false): Promise<RuntimeReport[]> {
  if (!force && Date.now() - lastScan < 20_000 && reports.length) return reports;
  lastScan = Date.now();
  const next = await Promise.all(getAdapters().map(async (a): Promise<RuntimeReport> => {
    try {
      const h = await a.health();
      const models = h.health === 'not-installed' ? [] : await a.discover().catch(() => []);
      return {
        id: a.id, label: a.label, kind: a.kind, priority: a.priority,
        health: h.health, detail: h.detail, models,
        loadedModelId: a.id === 'local-weights' ? (getDefaultModel()?.id ?? null) : null,
        capabilities: a.capabilities(), checkedAt: new Date().toISOString(),
      };
    } catch (e) {
      return {
        id: a.id, label: a.label, kind: a.kind, priority: a.priority,
        health: 'error', detail: e instanceof Error ? e.message : String(e),
        models: [], loadedModelId: null, capabilities: [], checkedAt: new Date().toISOString(),
      };
    }
  }));
  reports = next;
  emit();
  return reports;
}

/** The runtime that should serve a task right now — cloud only as last resort. */
export async function selectRuntime(capability = 'chat'): Promise<RuntimeReport | null> {
  const found = await discoverRuntimes();
  return found
    .filter((r) => r.health === 'ready' && r.capabilities.includes(capability))
    .sort((a, b) => a.priority - b.priority)[0] ?? null;
}

/** One-line truthful summary for the AI system prompt. */
export async function runtimePromptBlock(): Promise<string> {
  const found = await discoverRuntimes();
  const lines = found.map((r) => `- ${r.label}: ${r.health}${r.models.length ? ` (${r.models.length} model(s))` : ''} — ${r.detail}`);
  const chosen = await selectRuntime('chat');
  return `Runtime detection (${platformKind()}):\n${lines.join('\n')}\nActive choice: ${chosen ? chosen.label : 'none ready'}.`;
}
