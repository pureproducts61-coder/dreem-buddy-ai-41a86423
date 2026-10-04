/**
 * Dynamic AI Engine Router.
 * Priority (fully configurable, nothing hardcoded in call sites):
 *   1. Local GGUF model runtime
 *   2. Local AI API (LM Studio / Ollama / any OpenAI-compatible localhost server)
 *   3. Cloud AI APIs (Gemini / Groq / DeepSeek via the chat function)
 *   4. Lovable AI Gateway  — always the LAST fallback
 * If a local engine is running, cloud engines are never contacted.
 */
import { LocalRegistry } from './registry';
import { isLocalReady, probeRuntime, localChatStream } from './localRuntime';
import { getDefaultModel } from './modelManager';
import type { ExecutionResult, ResourceDescriptor } from './resourceContracts';
import { resolveResource, isCapabilityCredentialAvailable } from './resourceResolver';

export type EngineKind = 'local-gguf' | 'local-api' | 'cloud-api' | 'lovable-gateway';

export interface AiEngine {
  id: string;
  [key: string]: unknown;
  name: string;
  kind: EngineKind;
  enabled: boolean;
  priority: number;          // lower runs first
  baseUrl: string;           // used by local-api / cloud-api
  model: string;
  isFinalFallback: boolean;
  lastStatus: 'unknown' | 'ready' | 'unavailable' | 'error';
  lastCheckedAt?: string;
  lastError?: string;
}

const SEED: AiEngine[] = [
  { id: 'local-gguf', name: 'Local GGUF model', kind: 'local-gguf', enabled: true, priority: 1, baseUrl: '', model: '', isFinalFallback: false, lastStatus: 'unknown' },
  { id: 'local-api', name: 'Local AI API (Ollama / LM Studio)', kind: 'local-api', enabled: true, priority: 2, baseUrl: 'http://127.0.0.1:11434/v1', model: '', isFinalFallback: false, lastStatus: 'unknown' },
  { id: 'cloud-api', name: 'Cloud AI APIs', kind: 'cloud-api', enabled: true, priority: 3, baseUrl: '', model: '', isFinalFallback: false, lastStatus: 'unknown' },
  { id: 'lovable-gateway', name: 'Lovable AI Gateway', kind: 'lovable-gateway', enabled: true, priority: 99, baseUrl: '', model: '', isFinalFallback: true, lastStatus: 'unknown' },
];

export const engineRegistry = new LocalRegistry<AiEngine>('tivo-os-engines', SEED);

export function orderedEngines(): AiEngine[] {
  return engineRegistry.getAll()
    .filter((e) => e.enabled)
    .sort((a, b) => (a.isFinalFallback ? 1 : 0) - (b.isFinalFallback ? 1 : 0) || a.priority - b.priority);
}

export function finalFallbackEngine(): AiEngine | null {
  return engineRegistry.getAll().find((e) => e.isFinalFallback) ?? null;
}

let activeEngineId: string | null = null;
const listeners = new Set<() => void>();
export const subscribeEngines = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const emit = () => listeners.forEach((l) => l());
export const getActiveEngineId = () => activeEngineId;
export function setActiveEngine(id: string | null) { activeEngineId = id; emit(); }

function mark(id: string, status: AiEngine['lastStatus'], error?: string) {
  engineRegistry.update(id, { lastStatus: status, lastError: error, lastCheckedAt: new Date().toISOString() });
  emit();
}

/** Is an OpenAI-compatible local API answering? */
export async function probeLocalApi(baseUrl: string, timeoutMs = 1500): Promise<boolean> {
  if (!baseUrl) return false;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, { signal: c.signal });
    return res.ok;
  } catch { return false; } finally { clearTimeout(t); }
}

/** Each stage is only true after real evidence; 'unknown' when the server can't tell us. */
export interface LocalEngineStages {
  serverAnswered: boolean;
  modelFound: boolean;
  modelLoaded: boolean | 'unknown';
  replyProduced: boolean;
  model?: string;
  error?: string;
  checkedAt: string;
}

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 2500): Promise<unknown> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: c.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

/**
 * Stage-by-stage truth for an OpenAI-compatible local server (Ollama / LM Studio):
 * server answers → model found in /models → model loaded (Ollama /api/ps) → a real reply.
 * A model list alone never counts as working inference.
 */
export async function probeLocalEngineStages(engine: AiEngine, opts: { runInference?: boolean } = {}): Promise<LocalEngineStages> {
  const s: LocalEngineStages = { serverAnswered: false, modelFound: false, modelLoaded: 'unknown', replyProduced: false, checkedAt: new Date().toISOString() };
  const base = engine.baseUrl.replace(/\/$/, '');
  if (!base) { s.error = 'No server address configured.'; return s; }
  try {
    const list = (await fetchJson(`${base}/models`)) as { data?: Array<{ id: string }> };
    s.serverAnswered = true;
    const ids = (list.data ?? []).map((m) => m.id);
    const model = engine.model && ids.includes(engine.model) ? engine.model : engine.model ? undefined : ids[0];
    s.model = model;
    s.modelFound = Boolean(model);
    if (!model) { s.error = engine.model ? `Model "${engine.model}" not found on server.` : 'Server lists no models.'; return s; }
    // Ollama exposes loaded models at /api/ps (outside the /v1 prefix).
    try {
      const ps = (await fetchJson(`${base.replace(/\/v1$/, '')}/api/ps`)) as { models?: Array<{ name: string; model?: string }> };
      if (Array.isArray(ps.models)) s.modelLoaded = ps.models.some((m) => m.name === model || m.model === model);
    } catch { /* not Ollama — stays 'unknown' */ }
    if (opts.runInference !== false) {
      const out = (await fetchJson(`${base}/chat/completions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, stream: false, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with: ok' }] }),
      }, 60_000)) as { choices?: Array<{ message?: { content?: string } }> };
      s.replyProduced = Boolean(out.choices?.[0]?.message?.content?.trim());
      if (s.replyProduced) s.modelLoaded = true; // inference proves it is loaded now
      else s.error = 'Server answered but produced an empty reply.';
    }
  } catch (e) {
    s.error = e instanceof Error ? e.message : String(e);
  }
  engineRegistry.update(engine.id, { stages: s });
  emit();
  return s;
}

export async function refreshEngineStatuses(): Promise<AiEngine[]> {
  for (const e of engineRegistry.getAll()) {
    if (e.kind === 'local-gguf') {
      const ready = isLocalReady() || (await probeRuntime());
      mark(e.id, ready ? 'ready' : 'unavailable');
    } else if (e.kind === 'local-api') {
      // Cheap check (no inference): ready only when the server answers AND the model exists.
      const st = await probeLocalEngineStages(e, { runInference: false });
      mark(e.id, st.serverAnswered && st.modelFound ? 'ready' : 'unavailable', st.error);
    } else if (e.kind === 'cloud-api') {
      // Never claim ready from configuration alone — a credential must exist.
      const credentialed = await isCapabilityCredentialAvailable('ai.chat', 'chat').catch(() => false);
      mark(e.id, credentialed ? 'ready' : 'unavailable', credentialed ? undefined : 'No provider credential is available yet.');
    } else {
      mark(e.id, 'ready');
    }
  }
  return engineRegistry.getAll();
}

/** True when local inference should handle the request (never touch the cloud then). */
export async function preferLocal(): Promise<boolean> {
  const local = engineRegistry.get('local-gguf');
  if (!local?.enabled) return false;
  if (isLocalReady()) return true;
  const def = getDefaultModel();
  return Boolean(def && def.status === 'ready' && (await probeRuntime()));
}

/* ------------------------------------------------------------------ */
/* Resource/Capability seam — adapter only, routing above is unchanged  */
/* ------------------------------------------------------------------ */

/** Which configured resource backs the cloud path for a task type. */
export async function resolveEngineResource(taskType = 'chat'): Promise<ExecutionResult<ResourceDescriptor>> {
  return resolveResource({ capability: 'ai.chat', taskType });
}

/**
 * Truthful readiness for the cloud engine: a provider row existing is not
 * enough — a credential must actually be available for it.
 */
export async function cloudEngineCredentialAvailable(taskType = 'chat'): Promise<boolean> {
  return isCapabilityCredentialAvailable('ai.chat', taskType);
}

export interface RouterMessage { role: string; content: string }

/**
 * Try every local engine in priority order. Returns true when one of them
 * produced the answer; false means the caller should continue with the cloud
 * path (which itself ends at the Lovable AI Gateway fallback).
 */
export async function runLocalEngines(
  messages: RouterMessage[],
  onDelta: (t: string) => void,
  system?: string,
): Promise<boolean> {
  for (const engine of orderedEngines()) {
    if (engine.kind !== 'local-gguf' && engine.kind !== 'local-api') continue;
    try {
      if (engine.kind === 'local-gguf') {
        if (!(await preferLocal())) { mark(engine.id, 'unavailable'); continue; }
        setActiveEngine(engine.id);
        await localChatStream(messages, onDelta, { system });
        mark(engine.id, 'ready');
        return true;
      }
      if (!(await probeLocalApi(engine.baseUrl))) { mark(engine.id, 'unavailable'); continue; }
      setActiveEngine(engine.id);
      await localApiStream(engine, messages, onDelta, system);
      mark(engine.id, 'ready');
      return true;
    } catch (e) {
      mark(engine.id, 'error', e instanceof Error ? e.message : String(e));
      // fall through to the next engine automatically
    }
  }
  setActiveEngine(null);
  return false;
}

async function localApiStream(
  engine: AiEngine,
  messages: RouterMessage[],
  onDelta: (t: string) => void,
  system?: string,
) {
  const body = {
    model: engine.model || 'local-model',
    stream: true,
    messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
  };
  const res = await fetch(`${engine.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
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
        const parsed = JSON.parse(json);
        const text = parsed.choices?.[0]?.delta?.content ?? '';
        if (text) onDelta(text);
      } catch { /* skip */ }
    }
  }
}