/**
 * Real discovery of local LLM servers (OpenAI-compatible and Ollama).
 * Only runs where a local server can genuinely be reached: a native shell
 * (endpoints reported by the native bridge) or a desktop browser. "Configured"
 * never means "ready" — every endpoint here answered a real request.
 */
import { canProbeLocalHostServers, isNative } from './platform';
import { nativeServerEndpoints } from './nativeBridge';
import { engineRegistry } from './engineRouter';
import { getOllamaHost } from './ollama';

export interface LocalServer {
  url: string;
  kind: 'openai' | 'ollama';
  models: { id: string; name: string; sizeBytes?: number }[];
  checkedAt: string;
}

const TIMEOUT = 1500;

async function getJson(url: string): Promise<unknown | null> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: c.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; } finally { clearTimeout(t); }
}

async function probeOpenAi(base: string): Promise<LocalServer | null> {
  const data = await getJson(`${base.replace(/\/$/, '')}/models`) as { data?: { id?: string }[] } | null;
  if (!data) return null;
  return {
    url: base, kind: 'openai',
    models: (data.data || []).filter((m) => m.id).map((m) => ({ id: m.id as string, name: m.id as string })),
    checkedAt: new Date().toISOString(),
  };
}

async function probeOllama(base: string): Promise<LocalServer | null> {
  const data = await getJson(`${base.replace(/\/$/, '')}/api/tags`) as { models?: { name?: string; size?: number }[] } | null;
  if (!data) return null;
  return {
    url: base, kind: 'ollama',
    models: (data.models || []).filter((m) => m.name).map((m) => ({ id: m.name as string, name: m.name as string, sizeBytes: m.size })),
    checkedAt: new Date().toISOString(),
  };
}

let cache: { at: number; value: LocalServer[] } | null = null;

/** Throttled/cached scan — safe to call from any runtime discovery pass. */
export async function discoverLocalServers(force = false): Promise<LocalServer[]> {
  if (!force && cache && Date.now() - cache.at < 20_000) return cache.value;
  if (!canProbeLocalHostServers()) { cache = { at: Date.now(), value: [] }; return []; }

  const candidates = new Set<string>();
  // On native, only endpoints the native layer actually reports.
  if (isNative()) {
    for (const e of await nativeServerEndpoints()) candidates.add(e.url.replace(/\/$/, ''));
  } else {
    const configured = engineRegistry.get('local-api')?.baseUrl;
    if (configured) candidates.add(configured.replace(/\/$/, ''));
    candidates.add(getOllamaHost().replace(/\/$/, ''));
  }

  const found: LocalServer[] = [];
  for (const base of candidates) {
    const openai = await probeOpenAi(base.endsWith('/v1') ? base : `${base}/v1`);
    if (openai) { found.push(openai); continue; }
    const ollama = await probeOllama(base.replace(/\/v1$/, ''));
    if (ollama) found.push(ollama);
  }
  cache = { at: Date.now(), value: found };
  return found;
}

export const cachedLocalServers = () => cache?.value ?? [];
