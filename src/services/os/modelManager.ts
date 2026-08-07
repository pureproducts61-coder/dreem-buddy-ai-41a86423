/**
 * Local AI Model Manager — fully dynamic registry (no hardcoded model list in UI).
 * Models live in localStorage metadata; weights live in IndexedDB (imported/downloaded GGUF).
 */
import { LocalRegistry } from './registry';
import { onModelInstalled } from './orchestrator';

export type ModelSource = 'download' | 'import' | 'detected' | 'remote';
export type ModelStatus = 'registered' | 'downloading' | 'ready' | 'error' | 'verifying';

export interface LocalModel {
  id: string;
  [key: string]: unknown;
  name: string;
  family: string;          // gemma | qwen | llama | deepseek | mistral | phi | custom
  version: string;
  params: string;          // "2B"
  quant: string;           // "Q4_K_M"
  url: string;             // download URL (empty for imported files)
  sizeBytes: number;
  bytesDownloaded: number;
  status: ModelStatus;
  enabled: boolean;
  isDefault: boolean;
  source: ModelSource;
  checksum?: string;       // sha256 when known
  verified?: boolean;
  addedAt: string;
  lastUsedAt?: string;
  notes?: string;
  error?: string;
}

/** Recommendation catalog — editable seed only, never a hard constraint. */
export interface ModelSuggestion {
  name: string; family: string; params: string; quant: string;
  sizeBytes: number; url: string; minRamGb: number; tier: 'mobile' | 'light' | 'balanced' | 'power';
}

export const MODEL_CATALOG_KEY = 'tivo-os-model-catalog';

const DEFAULT_CATALOG: ModelSuggestion[] = [
  { name: 'Gemma 3 2B Instruct', family: 'gemma', params: '2B', quant: 'Q4_K_M', sizeBytes: 1_600_000_000, url: 'https://huggingface.co/ggml-org/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf', minRamGb: 2, tier: 'mobile' },
  { name: 'Qwen3 1.7B Instruct', family: 'qwen', params: '1.7B', quant: 'Q4_K_M', sizeBytes: 1_100_000_000, url: 'https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf', minRamGb: 2, tier: 'mobile' },
  { name: 'Phi-4 Mini', family: 'phi', params: '3.8B', quant: 'Q4_K_M', sizeBytes: 2_400_000_000, url: '', minRamGb: 6, tier: 'light' },
  { name: 'Llama 3.2 3B Instruct', family: 'llama', params: '3B', quant: 'Q4_K_M', sizeBytes: 2_000_000_000, url: '', minRamGb: 6, tier: 'light' },
  { name: 'Mistral 7B Instruct', family: 'mistral', params: '7B', quant: 'Q4_K_M', sizeBytes: 4_400_000_000, url: '', minRamGb: 8, tier: 'balanced' },
  { name: 'DeepSeek R1 Distill 8B', family: 'deepseek', params: '8B', quant: 'Q4_K_M', sizeBytes: 4_900_000_000, url: '', minRamGb: 12, tier: 'power' },
];

export const modelRegistry = new LocalRegistry<LocalModel>('tivo-os-models', []);

export function getCatalog(): ModelSuggestion[] {
  try {
    const raw = localStorage.getItem(MODEL_CATALOG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return DEFAULT_CATALOG;
}

export function saveCatalog(list: ModelSuggestion[]) {
  localStorage.setItem(MODEL_CATALOG_KEY, JSON.stringify(list));
}

/* ---------------- hardware detection ---------------- */

export interface HardwareProfile {
  isMobile: boolean;
  cores: number;
  ramGb: number;
  gpu: string;
  storageQuotaGb: number;
  storageUsedGb: number;
}

export async function detectHardware(): Promise<HardwareProfile> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  let gpu = 'unknown';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
    if (gl && dbg) gpu = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
  } catch { /* ignore */ }

  let quota = 0, usage = 0;
  try {
    const est = await navigator.storage?.estimate?.();
    quota = est?.quota || 0;
    usage = est?.usage || 0;
  } catch { /* ignore */ }

  return {
    isMobile: /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent),
    cores: nav.hardwareConcurrency || 4,
    ramGb: nav.deviceMemory || 4,
    gpu,
    storageQuotaGb: quota / 1e9,
    storageUsedGb: usage / 1e9,
  };
}

export function recommendModels(hw: HardwareProfile): ModelSuggestion[] {
  const catalog = getCatalog();
  const fits = catalog.filter((m) => m.minRamGb <= hw.ramGb);
  if (hw.isMobile) return fits.filter((m) => m.tier === 'mobile');
  return fits.length ? fits : catalog.slice(0, 2);
}

/* ---------------- weight storage (IndexedDB) ---------------- */

const DB_NAME = 'tivo-os-models';
const STORE = 'weights';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putWeights(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getWeights(id: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteWeights(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
  });
}

/* ---------------- lifecycle ---------------- */

export function registerModel(input: Partial<LocalModel> & { name: string }): LocalModel {
  return modelRegistry.add({
    name: input.name,
    family: input.family || 'custom',
    version: input.version || '1',
    params: input.params || '',
    quant: input.quant || '',
    url: input.url || '',
    sizeBytes: input.sizeBytes || 0,
    bytesDownloaded: input.bytesDownloaded || 0,
    status: input.status || 'registered',
    enabled: input.enabled ?? true,
    isDefault: input.isDefault ?? modelRegistry.getAll().length === 0,
    source: input.source || 'download',
    checksum: input.checksum,
    verified: input.verified,
    addedAt: new Date().toISOString(),
    notes: input.notes,
  } as Omit<LocalModel, 'id'>);
}

export function setDefaultModel(id: string) {
  modelRegistry.replaceAll(modelRegistry.getAll().map((m) => ({ ...m, isDefault: m.id === id })));
}

export function getDefaultModel(): LocalModel | null {
  return modelRegistry.getAll().find((m) => m.isDefault && m.enabled) ?? null;
}

export async function removeModel(id: string) {
  await deleteWeights(id).catch(() => {});
  modelRegistry.remove(id);
}

const abortMap = new Map<string, AbortController>();

export function cancelDownload(id: string) {
  abortMap.get(id)?.abort();
  abortMap.delete(id);
  modelRegistry.update(id, { status: 'registered' });
}

export async function downloadModel(id: string, onProgress?: (pct: number) => void): Promise<void> {
  const model = modelRegistry.get(id);
  if (!model) throw new Error('Model not found');
  if (!model.url) throw new Error('This model has no download URL. Import the GGUF file instead.');

  const controller = new AbortController();
  abortMap.set(id, controller);
  modelRegistry.update(id, { status: 'downloading', bytesDownloaded: 0, error: undefined });

  try {
    const res = await fetch(model.url, { signal: controller.signal });
    if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
    const total = Number(res.headers.get('content-length')) || model.sizeBytes || 0;
    const reader = res.body.getReader();
    const chunks: BlobPart[] = [];
    let received = 0;
    let lastTick = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value as unknown as BlobPart);
        received += value.byteLength;
        const now = Date.now();
        if (now - lastTick > 400) {
          lastTick = now;
          modelRegistry.update(id, { bytesDownloaded: received, sizeBytes: total || received });
          onProgress?.(total ? (received / total) * 100 : 0);
        }
      }
    }
    const blob = new Blob(chunks);
    await putWeights(id, blob);
    modelRegistry.update(id, { status: 'ready', bytesDownloaded: blob.size, sizeBytes: blob.size });
    void onModelInstalled();
    onProgress?.(100);
  } catch (e) {
    modelRegistry.update(id, {
      status: 'error',
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  } finally {
    abortMap.delete(id);
  }
}

export async function importModelFile(file: File): Promise<LocalModel> {
  const guessFamily = (n: string) => {
    const s = n.toLowerCase();
    return ['gemma', 'qwen', 'llama', 'deepseek', 'mistral', 'phi'].find((f) => s.includes(f)) || 'custom';
  };
  const model = registerModel({
    name: file.name.replace(/\.gguf$/i, ''),
    family: guessFamily(file.name),
    quant: (file.name.match(/Q\d[_A-Za-z0-9]*/i) || [''])[0],
    sizeBytes: file.size,
    bytesDownloaded: file.size,
    source: 'import',
    status: 'ready',
  });
  await putWeights(model.id, file);
  return model;
}

/** Integrity verification: presence + size match + optional sha256. */
export async function verifyModel(id: string): Promise<{ ok: boolean; reason: string }> {
  const model = modelRegistry.get(id);
  if (!model) return { ok: false, reason: 'Model not found' };
  modelRegistry.update(id, { status: 'verifying' });
  const blob = await getWeights(id).catch(() => null);
  if (!blob) {
    modelRegistry.update(id, { status: 'error', verified: false, error: 'Weights missing' });
    return { ok: false, reason: 'Weights are not stored on this device' };
  }
  if (model.sizeBytes && Math.abs(blob.size - model.sizeBytes) > 1024) {
    modelRegistry.update(id, { status: 'error', verified: false, error: 'Size mismatch' });
    return { ok: false, reason: 'File size does not match the expected size' };
  }
  if (model.checksum) {
    try {
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
      const ok = hex.toLowerCase() === model.checksum.toLowerCase();
      modelRegistry.update(id, { status: ok ? 'ready' : 'error', verified: ok });
      return { ok, reason: ok ? 'Checksum matches' : 'Checksum mismatch' };
    } catch { /* fall through */ }
  }
  modelRegistry.update(id, { status: 'ready', verified: true, error: undefined });
  void onModelInstalled();
  return { ok: true, reason: 'File present and size matches' };
}

/** Automatic detection: re-attach registry entries to weights already in IndexedDB. */
export async function autoDetectModels(): Promise<number> {
  let recovered = 0;
  for (const m of modelRegistry.getAll()) {
    if (m.status === 'ready') continue;
    const blob = await getWeights(m.id).catch(() => null);
    if (blob) {
      modelRegistry.update(m.id, { status: 'ready', bytesDownloaded: blob.size, sizeBytes: blob.size, source: 'detected' });
      recovered += 1;
    }
  }
  return recovered;
}

export function storageUsage(): { totalBytes: number; count: number } {
  const all = modelRegistry.getAll().filter((m) => m.status === 'ready');
  return { totalBytes: all.reduce((s, m) => s + (m.sizeBytes || 0), 0), count: all.length };
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

const AUTO_KEY = 'tivo-os-mobile-autodownload';

/**
 * Mobile PWA default behaviour: register (and offer) the lightest model automatically.
 * Desktop: never force a download — only recommend.
 */
export async function ensureDefaultLocalModel(): Promise<LocalModel | null> {
  if (modelRegistry.getAll().length > 0) return getDefaultModel();
  const hw = await detectHardware();
  const pick = recommendModels(hw)[0] || getCatalog()[0];
  if (!pick) return null;
  const model = registerModel({
    name: pick.name, family: pick.family, params: pick.params, quant: pick.quant,
    url: pick.url, sizeBytes: pick.sizeBytes, isDefault: true,
    notes: hw.isMobile ? 'Auto-selected lightweight model for mobile' : 'Recommended for this hardware',
  });
  if (hw.isMobile && pick.url && localStorage.getItem(AUTO_KEY) !== 'off') {
    downloadModel(model.id).catch(() => {});
  }
  return model;
}