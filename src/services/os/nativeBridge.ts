/**
 * Android/iOS native bridge interface (Capacitor).
 *
 * This is the ONLY place TIVO is allowed to ask the device about things a
 * browser can never know: local model files on disk, locally listening LLM
 * servers, and whether a process runtime exists. If the native plugin is not
 * installed (plain browser / PWA, or an APK built before the plugin exists),
 * every call fails soft and returns "unavailable" — never a fake ready state.
 *
 * Nothing here scans the filesystem from the browser and nothing is bundled:
 * the native layer answers, or TIVO says it cannot know.
 */
import { isNative } from './platform';

export interface NativeRuntimeInfo {
  available: boolean;
  /** e.g. "android" */
  platform: string;
  /** true when the native shell exposes a process/exec runtime */
  processRuntime: boolean;
  /** true when the native shell hosts an on-device inference service */
  inferenceService: boolean;
  detail: string;
}

export interface NativeModelFile {
  id: string;
  name: string;
  path: string;
  sizeBytes?: number;
  format?: string;
}

export interface NativeServerEndpoint {
  /** http://127.0.0.1:11434 */
  url: string;
  /** 'ollama' | 'openai' | 'unknown' */
  kind: string;
}

interface TivoNativePlugin {
  getRuntimeInfo?: () => Promise<Partial<NativeRuntimeInfo>>;
  listLocalModels?: () => Promise<{ models?: NativeModelFile[] }>;
  listServerEndpoints?: () => Promise<{ endpoints?: NativeServerEndpoint[] }>;
}

function plugin(): TivoNativePlugin | null {
  if (typeof window === 'undefined' || !isNative()) return null;
  const cap = (window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
  return (cap?.Plugins?.TivoNative as TivoNativePlugin) ?? null;
}

export const hasNativeBridge = () => plugin() !== null;

const UNAVAILABLE: NativeRuntimeInfo = {
  available: false,
  platform: 'web',
  processRuntime: false,
  inferenceService: false,
  detail: 'No native layer on this device — TIVO only uses what the browser can genuinely reach.',
};

/* Small cache so repeated runtime scans never hammer the native layer. */
let infoCache: { at: number; value: NativeRuntimeInfo } | null = null;

export async function nativeRuntimeInfo(force = false): Promise<NativeRuntimeInfo> {
  if (!force && infoCache && Date.now() - infoCache.at < 30_000) return infoCache.value;
  const p = plugin();
  if (!p?.getRuntimeInfo) {
    infoCache = { at: Date.now(), value: UNAVAILABLE };
    return UNAVAILABLE;
  }
  try {
    const raw = await p.getRuntimeInfo();
    const value: NativeRuntimeInfo = {
      available: true,
      platform: raw.platform || 'android',
      processRuntime: raw.processRuntime === true,
      inferenceService: raw.inferenceService === true,
      detail: raw.detail || 'Native layer answered.',
    };
    infoCache = { at: Date.now(), value };
    return value;
  } catch (e) {
    const value: NativeRuntimeInfo = { ...UNAVAILABLE, detail: e instanceof Error ? e.message : 'Native layer did not answer.' };
    infoCache = { at: Date.now(), value };
    return value;
  }
}

/** Model files that already exist on the device — never re-downloaded by TIVO. */
export async function nativeLocalModels(): Promise<NativeModelFile[]> {
  const p = plugin();
  if (!p?.listLocalModels) return [];
  try { return (await p.listLocalModels()).models ?? []; } catch { return []; }
}

/** Local LLM server endpoints the native layer knows about (never guessed). */
export async function nativeServerEndpoints(): Promise<NativeServerEndpoint[]> {
  const p = plugin();
  if (!p?.listServerEndpoints) return [];
  try { return (await p.listServerEndpoints()).endpoints ?? []; } catch { return []; }
}
