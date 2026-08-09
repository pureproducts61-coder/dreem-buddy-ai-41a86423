/**
 * Ollama discovery for the computer-side model architecture.
 * Detection order: the Desktop Bridge (works even when the browser cannot
 * reach localhost), then a direct call to the Ollama HTTP API. Nothing is
 * hardcoded — the installed model list always comes from the runtime.
 */
import { bridgeCall, isPermitted } from './desktopBridge';
import { getBridgeMonitorState } from './bridgeMonitor';
import { reportRuntimeCapability } from './capabilities';

const HOST_KEY = 'tivo-os-ollama-host';
const CACHE_KEY = 'tivo-os-ollama-state';
const DEFAULT_HOST = 'http://127.0.0.1:11434';

export interface OllamaModel {
  name: string;
  family?: string;
  params?: string;
  quant?: string;
  sizeBytes?: number;
  modifiedAt?: string;
  health: 'ready' | 'unknown';
}

export interface OllamaState {
  installed: boolean;
  running: boolean;
  version: string | null;
  host: string;
  models: OllamaModel[];
  source: 'bridge' | 'http' | 'none';
  error: string | null;
  checkedAt: string;
}

export const getOllamaHost = () => localStorage.getItem(HOST_KEY) || DEFAULT_HOST;
export const setOllamaHost = (h: string) => localStorage.setItem(HOST_KEY, h.replace(/\/$/, ''));

let state: OllamaState = (() => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as OllamaState; } catch { /* ignore */ }
  return null as unknown as OllamaState;
})() || {
  installed: false, running: false, version: null, host: DEFAULT_HOST,
  models: [], source: 'none', error: null, checkedAt: new Date(0).toISOString(),
};

const listeners = new Set<() => void>();
export const subscribeOllama = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getOllamaState = () => state;

function publish(next: Partial<OllamaState>) {
  state = { ...state, ...next, host: getOllamaHost(), checkedAt: new Date().toISOString() };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  listeners.forEach((l) => l());
  reportRuntimeCapability({
    id: 'ollama', label: 'Ollama models',
    state: state.running ? 'ready' : state.installed ? 'unavailable' : 'unavailable',
    detail: state.running
      ? `${state.models.length} model${state.models.length === 1 ? '' : 's'} installed${state.version ? ` · Ollama ${state.version}` : ''}`
      : state.installed ? 'Ollama is installed but not running' : 'Ollama was not found on this computer',
    health: state.running ? 'good' : 'down',
  });
}

function normalise(raw: unknown): OllamaModel[] {
  const rows = Array.isArray(raw) ? raw : (raw as { models?: unknown[] })?.models || [];
  return (rows as Record<string, unknown>[]).map((m) => {
    const details = (m.details || {}) as Record<string, string>;
    return {
      name: String(m.name || m.model || 'unknown'),
      family: details.family,
      params: details.parameter_size,
      quant: details.quantization_level,
      sizeBytes: Number(m.size) || undefined,
      modifiedAt: typeof m.modified_at === 'string' ? m.modified_at : undefined,
      health: 'ready' as const,
    };
  });
}

async function httpJson(url: string, timeoutMs = 2000): Promise<unknown> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: c.signal });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally { clearTimeout(t); }
}

/** Full discovery pass. Never throws — it always publishes an accurate state. */
export async function discoverOllama(): Promise<OllamaState> {
  // 1. through the Bridge (preferred: it can also see a stopped installation)
  if (getBridgeMonitorState().state === 'connected' && isPermitted('system.info')) {
    try {
      const info = await bridgeCall<{ installed?: boolean; running?: boolean; version?: string; models?: unknown }>(
        'system.info', 'ollama.discover', {},
      );
      publish({
        installed: info.installed ?? Boolean(info.running),
        running: Boolean(info.running),
        version: info.version || null,
        models: normalise(info.models),
        source: 'bridge', error: null,
      });
      return state;
    } catch { /* fall through to direct HTTP */ }
  }

  // 2. direct HTTP to the Ollama daemon
  try {
    const host = getOllamaHost();
    const tags = await httpJson(`${host}/api/tags`);
    let version: string | null = null;
    try { version = String(((await httpJson(`${host}/api/version`)) as { version?: string }).version || '') || null; } catch { /* optional */ }
    publish({ installed: true, running: true, version, models: normalise(tags), source: 'http', error: null });
  } catch {
    publish({
      running: false, models: [], source: 'none',
      error: 'Ollama did not answer on this computer. Install it, or start it and press Check again.',
    });
  }
  return state;
}

/** Models exposed to the Model Router, tagged with the device they live on. */
export function ollamaModelsForRouting() {
  return state.running ? state.models : [];
}

let started = false;
export function startOllamaDiscovery(intervalMs = 120_000) {
  if (started) return;
  started = true;
  void discoverOllama();
  setInterval(() => { void discoverOllama(); }, intervalMs);
}
