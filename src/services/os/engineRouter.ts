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

export async function refreshEngineStatuses(): Promise<AiEngine[]> {
  for (const e of engineRegistry.getAll()) {
    if (e.kind === 'local-gguf') {
      const ready = isLocalReady() || (await probeRuntime());
      mark(e.id, ready ? 'ready' : 'unavailable');
    } else if (e.kind === 'local-api') {
      mark(e.id, (await probeLocalApi(e.baseUrl)) ? 'ready' : 'unavailable');
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