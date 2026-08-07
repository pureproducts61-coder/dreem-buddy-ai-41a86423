/**
 * Model orchestration. Every model declares what it can do and what it needs;
 * the router asks here which local model should serve a task. Nothing is
 * hardcoded — declarations live on the model records and can be edited in Admin.
 */
import { modelRegistry, detectHardware, type LocalModel } from './modelManager';

export type ModelTask =
  | 'chat' | 'reasoning' | 'coding' | 'vision' | 'ocr'
  | 'speech' | 'embedding' | 'tool-calling' | 'planning';

export interface ModelRequirements {
  capabilities: ModelTask[];
  ramGb: number;
  vramGb: number;
  cpuCores: number;
  needsGpu: boolean;
}

/** Reads declared requirements, falling back to sensible inference from the file. */
export function modelRequirements(m: LocalModel): ModelRequirements {
  const declared = (m.capabilities as ModelTask[] | undefined) || [];
  const name = `${m.name} ${m.family}`.toLowerCase();
  const inferred: ModelTask[] = ['chat'];
  if (/instruct|chat|it\b/.test(name)) inferred.push('tool-calling', 'planning');
  if (/coder|code|deepseek|qwen/.test(name)) inferred.push('coding', 'reasoning');
  if (/r1|reason|think/.test(name)) inferred.push('reasoning');
  if (/vl|vision|llava|moondream|florence/.test(name)) inferred.push('vision');
  if (/ocr|trocr|got|tesseract/.test(name)) inferred.push('ocr', 'vision');
  if (/whisper|speech|voice|parakeet/.test(name)) inferred.push('speech');
  if (/embed|bge|gte|minilm|nomic/.test(name)) inferred.push('embedding');
  const gb = (m.sizeBytes || 0) / 1e9;
  return {
    capabilities: declared.length ? declared : [...new Set(inferred)],
    ramGb: Number(m.ramGb) || Math.max(2, Math.ceil(gb * 1.5)),
    vramGb: Number(m.vramGb) || Math.ceil(gb),
    cpuCores: Number(m.cpuCores) || 4,
    needsGpu: m.needsGpu === true,
  };
}

export interface ModelChoice {
  model: LocalModel | null;
  reason: string;
  missing: boolean;
  task: ModelTask;
}

/** Picks the best ready local model for a task, or reports what is missing. */
export async function selectModelFor(task: ModelTask): Promise<ModelChoice> {
  const hw = await detectHardware();
  const ready = modelRegistry.getAll().filter((m) => m.enabled && m.status === 'ready');
  const capable = ready
    .map((m) => ({ m, req: modelRequirements(m) }))
    .filter((x) => x.req.capabilities.includes(task))
    .filter((x) => x.req.ramGb <= hw.ramGb + 2)
    .sort((a, b) => (b.m.isDefault ? 1 : 0) - (a.m.isDefault ? 1 : 0) || (b.m.sizeBytes || 0) - (a.m.sizeBytes || 0));

  if (capable.length) {
    return { model: capable[0].m, reason: `Using ${capable[0].m.name} for ${task}`, missing: false, task };
  }
  const registeredButNotReady = modelRegistry.getAll().find((m) => modelRequirements(m).capabilities.includes(task));
  return {
    model: null,
    missing: true,
    task,
    reason: registeredButNotReady
      ? `"${registeredButNotReady.name}" can do ${task} but its files are not downloaded yet.`
      : `No local model on this device can do ${task} yet.`,
  };
}

export interface MissingModelNotice {
  task: ModelTask;
  message: string;
  options: ('download' | 'import' | 'ignore')[];
  at: string;
}

const NOTICE_KEY = 'tivo-os-missing-models';

export function noteMissingModel(task: ModelTask, message: string) {
  const list = listMissingModelNotices().filter((n) => n.task !== task);
  list.push({ task, message, options: ['download', 'import', 'ignore'], at: new Date().toISOString() });
  localStorage.setItem(NOTICE_KEY, JSON.stringify(list));
  return list;
}

export function listMissingModelNotices(): MissingModelNotice[] {
  try { return JSON.parse(localStorage.getItem(NOTICE_KEY) || '[]'); } catch { return []; }
}

export function clearMissingModelNotice(task: ModelTask) {
  localStorage.setItem(NOTICE_KEY, JSON.stringify(listMissingModelNotices().filter((n) => n.task !== task)));
}

/** Ensure a task has a model; never fails silently — records a user-facing notice. */
export async function requireModelFor(task: ModelTask): Promise<ModelChoice> {
  const choice = await selectModelFor(task);
  if (choice.missing) noteMissingModel(task, choice.reason);
  else clearMissingModelNotice(task);
  return choice;
}

export function orchestrationPromptBlock(): string {
  const rows = modelRegistry.getAll().filter((m) => m.enabled).map((m) => {
    const r = modelRequirements(m);
    return `- ${m.name} [${m.status}] can: ${r.capabilities.join(', ')} (needs ~${r.ramGb}GB RAM${r.needsGpu ? ', GPU' : ''})`;
  });
  return rows.join('\n');
}

/* ---------------- automatic model resolution ---------------- */

export interface PendingModelRequest {
  task: ModelTask;
  explanation: string;
  /** re-runs the original action once the model is installed */
  retry: () => void | Promise<void>;
}

let pending: PendingModelRequest | null = null;
const requestListeners = new Set<() => void>();
export const subscribeModelRequests = (fn: () => void) => { requestListeners.add(fn); return () => { requestListeners.delete(fn); }; };
export const getPendingModelRequest = () => pending;
export function clearPendingModelRequest() { pending = null; requestListeners.forEach((l) => l()); }

/**
 * Ensures a model exists for a task. When one is missing the caller gets back
 * `null` and the UI is handed a human explanation plus a retry callback, so the
 * original action resumes automatically after Download / Import GGUF —
 * never a silent failure and never a manual restart.
 */
export async function requireModelWithRetry(task: ModelTask, retry: () => void | Promise<void>) {
  const choice = await requireModelFor(task);
  if (!choice.missing) return choice;
  pending = {
    task,
    explanation: `${choice.reason} Download a model, or import a GGUF file from this computer — I will continue automatically once it is ready.`,
    retry,
  };
  requestListeners.forEach((l) => l());
  return choice;
}

/** Called by the Model Manager when a model finishes installing. */
export async function onModelInstalled() {
  if (!pending) return;
  const choice = await requireModelFor(pending.task);
  if (choice.missing) return;
  const { retry } = pending;
  clearPendingModelRequest();
  await retry();
}
  return rows.join('\n');
}
