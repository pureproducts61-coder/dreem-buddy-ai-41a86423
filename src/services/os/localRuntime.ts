/**
 * Local GGUF model runtime.
 * The heavy lifting (llama.cpp) runs inside the Desktop Bridge / local runtime
 * server. This module owns the *state machine*: load, activate, inference
 * status, memory usage, error detection and automatic recovery.
 * Everything fails soft — when no runtime is present the Engine Router simply
 * moves on to the next engine.
 */
import { reportRuntimeCapability } from './capabilities';
import { getEndpoint, getPairToken } from './desktopBridge';
import { modelRegistry, getWeights, getDefaultModel, setDefaultModel, type LocalModel } from './modelManager';

export type RuntimeState = 'idle' | 'loading' | 'loaded' | 'inferring' | 'error' | 'unavailable';

export interface RuntimeStatus {
  state: RuntimeState;
  modelId: string | null;
  modelName: string | null;
  message: string;
  memoryBytes: number;
  lastError?: string;
  lastInferenceMs?: number;
  recoveries: number;
  updatedAt: string;
}

let status: RuntimeStatus = {
  state: 'idle', modelId: null, modelName: null, message: 'No local model loaded.',
  memoryBytes: 0, recoveries: 0, updatedAt: new Date().toISOString(),
};

const listeners = new Set<() => void>();
export const subscribeRuntime = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const getRuntimeStatus = () => status;

function set(patch: Partial<RuntimeStatus>) {
  status = { ...status, ...patch, updatedAt: new Date().toISOString() };
  listeners.forEach((l) => l());
}

function authHeaders(): Record<string, string> {
  const token = getPairToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Is a local inference runtime reachable right now? */
export async function probeRuntime(timeoutMs = 1500): Promise<boolean> {
  const report = (ok: boolean, detail: string) => reportRuntimeCapability({
    id: 'local-runtime', label: 'Local GGUF runtime',
    state: ok ? 'ready' : 'unavailable', detail, health: ok ? 'good' : 'down',
  });
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(`${getEndpoint()}/llm/health`, { signal: c.signal, headers: authHeaders() });
    report(res.ok, res.ok ? 'Local inference server is answering' : 'Local inference server refused the request');
    return res.ok;
  } catch {
    report(false, 'No local inference server is reachable');
    return false;
  } finally { clearTimeout(t); }
}

/** Load a downloaded GGUF model into the local runtime. */
export async function loadModel(id: string): Promise<boolean> {
  const model = modelRegistry.get(id) as LocalModel | null;
  if (!model) { set({ state: 'error', lastError: 'Model not found', message: 'That model is not registered.' }); return false; }
  if (model.status !== 'ready') {
    set({ state: 'error', lastError: 'Weights not ready', message: 'The model file is not downloaded yet.' });
    return false;
  }
  const blob = await getWeights(id).catch(() => null);
  if (!blob) {
    set({ state: 'error', lastError: 'Weights missing', message: 'I could not find the model file on this device.' });
    return false;
  }
  set({ state: 'loading', modelId: id, modelName: model.name, message: `I am loading ${model.name} on this device.`, memoryBytes: 0 });

  if (!(await probeRuntime())) {
    set({ state: 'unavailable', message: 'No local model runtime is running on this computer, so I cannot load it here yet.' });
    return false;
  }
  try {
    const form = new FormData();
    form.append('id', id);
    form.append('name', model.name);
    form.append('model', blob, `${model.name}.gguf`);
    const res = await fetch(`${getEndpoint()}/llm/load`, { method: 'POST', headers: authHeaders(), body: form });
    if (!res.ok) throw new Error(`Runtime refused the model (${res.status})`);
    const body = await res.json().catch(() => ({}));
    modelRegistry.update(id, { lastUsedAt: new Date().toISOString() });
    set({
      state: 'loaded',
      memoryBytes: Number(body.memoryBytes) || blob.size,
      message: `${model.name} is loaded and ready.`,
      lastError: undefined,
    });
    return true;
  } catch (e) {
    set({ state: 'error', lastError: e instanceof Error ? e.message : String(e), message: 'The local model failed to load.' });
    return false;
  }
}

export async function unloadModel(): Promise<void> {
  try { await fetch(`${getEndpoint()}/llm/unload`, { method: 'POST', headers: authHeaders() }); } catch { /* ignore */ }
  set({ state: 'idle', modelId: null, modelName: null, memoryBytes: 0, message: 'Local model unloaded.' });
}

/** Activate a model: make it the single default and load it. */
export async function activateModel(id: string): Promise<boolean> {
  setDefaultModel(id);
  modelRegistry.update(id, { enabled: true });
  return loadModel(id);
}

export async function deactivateModel(id: string): Promise<void> {
  modelRegistry.update(id, { enabled: false, isDefault: false });
  if (status.modelId === id) await unloadModel();
}

export function isLocalReady(): boolean {
  return status.state === 'loaded' || status.state === 'inferring';
}

/** Automatic recovery: reload the default model after a runtime error. */
export async function recoverRuntime(): Promise<boolean> {
  const target = status.modelId || getDefaultModel()?.id;
  if (!target) return false;
  set({ recoveries: status.recoveries + 1, message: 'The local model stopped responding — I am restarting it.' });
  await unloadModel();
  return loadModel(target);
}

export interface LocalChatMessage { role: string; content: string }

/** Streaming local inference. Throws when unavailable so the router can fall through. */
export async function localChatStream(
  messages: LocalChatMessage[],
  onDelta: (t: string) => void,
  opts: { system?: string; retry?: boolean } = {},
): Promise<void> {
  if (!isLocalReady()) throw new Error('LOCAL_NOT_READY');
  const started = performance.now();
  set({ state: 'inferring', message: 'I am thinking this through on your own device.' });
  try {
    const res = await fetch(`${getEndpoint()}/llm/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ messages, system: opts.system, stream: true }),
    });
    if (!res.ok || !res.body) throw new Error(`Local inference failed (${res.status})`);
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
          const parsed = JSON.parse(json);
          const text = parsed.choices?.[0]?.delta?.content ?? parsed.content ?? '';
          if (text) onDelta(text);
        } catch { /* skip */ }
      }
    }
    set({ state: 'loaded', lastInferenceMs: Math.round(performance.now() - started), message: 'Local model is ready.' });
  } catch (e) {
    set({ state: 'error', lastError: e instanceof Error ? e.message : String(e), message: 'Local inference failed.' });
    if (!opts.retry && await recoverRuntime()) {
      return localChatStream(messages, onDelta, { ...opts, retry: true });
    }
    throw e;
  }
}

/** Bring the runtime back up on app start when a default model exists. */
export async function autoStartRuntime(): Promise<void> {
  const def = getDefaultModel();
  if (!def || def.status !== 'ready') return;
  if (!(await probeRuntime())) { set({ state: 'unavailable', message: 'Local runtime is offline.' }); return; }
  await loadModel(def.id);
}