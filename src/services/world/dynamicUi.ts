/**
 * Dynamic UI Schema (Blueprint PART 14).
 * The Brain emits declarative JSON only; a trusted renderer draws it.
 * No HTML, scripts, URLs-as-actions or styles are accepted. Anything
 * unknown or malformed is rejected (fail closed). Actions only emit an
 * intent id back to the app — they never execute anything by themselves.
 */
import type { Risk } from './contracts';
import type { LifecycleStage, VerificationStatus } from './evidence';

export const UI_BLOCK_TYPES = [
  'clarification', 'choice', 'form', 'approval', 'progress', 'evidence', 'notice',
] as const;
export type UiBlockType = typeof UI_BLOCK_TYPES[number];

export interface UiAction { id: string; label: string; variant?: 'primary' | 'secondary' | 'danger' }
export interface UiField {
  name: string; label: string;
  kind: 'text' | 'textarea' | 'number' | 'select' | 'checkbox';
  required?: boolean; placeholder?: string; options?: string[];
}

interface Base { id: string; title?: string; body?: string }
export type UiBlock =
  | (Base & { type: 'clarification'; question: string; actions?: UiAction[] })
  | (Base & { type: 'choice'; options: UiAction[] })
  | (Base & { type: 'form'; fields: UiField[]; submit: UiAction })
  | (Base & { type: 'approval'; action: string; risk: Risk; reversible: boolean; approve: UiAction; reject: UiAction })
  | (Base & { type: 'progress'; stages: Array<{ stage: LifecycleStage; label: string; done: boolean; active?: boolean }> })
  | (Base & { type: 'evidence'; status: VerificationStatus; items: Array<{ label: string; value: string }> })
  | (Base & { type: 'notice'; tone: 'info' | 'warning' | 'error' | 'success' });

export interface UiSchema { version: 1; blocks: UiBlock[] }

export type UiEvent = { blockId: string; actionId: string; values?: Record<string, unknown> };

const MAX_BLOCKS = 12, MAX_STR = 2000, MAX_ITEMS = 20;
const RISKS = ['none', 'low', 'medium', 'high', 'critical'];
const STAGES = ['proposed', 'authorized', 'executing', 'observed', 'verified', 'failed', 'blocked'];
const VSTAT = ['PASS', 'PARTIAL', 'FAILED', 'UNCERTAIN', 'BLOCKED', 'NOT_VERIFIABLE'];
const KINDS = ['text', 'textarea', 'number', 'select', 'checkbox'];
const ID = /^[a-zA-Z0-9_.:-]{1,64}$/;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = MAX_STR): string | null =>
  typeof v === 'string' && v.length <= max && !/<\s*\/?\s*(script|iframe|object|embed|style)/i.test(v) ? v : null;
const optStr = (v: unknown) => (v === undefined ? undefined : str(v) ?? null);
const arr = (v: unknown): unknown[] | null => (Array.isArray(v) && v.length <= MAX_ITEMS ? v : null);

function action(v: unknown): UiAction | null {
  if (!isObj(v) || typeof v.id !== 'string' || !ID.test(v.id)) return null;
  const label = str(v.label, 80);
  if (!label) return null;
  const variant = v.variant === undefined ? undefined : (['primary', 'secondary', 'danger'].includes(v.variant as string) ? v.variant as UiAction['variant'] : null);
  if (variant === null) return null;
  return { id: v.id, label, ...(variant ? { variant } : {}) };
}
function actions(v: unknown): UiAction[] | null {
  const a = arr(v); if (!a) return null;
  const out = a.map(action);
  return out.every(Boolean) ? (out as UiAction[]) : null;
}
function field(v: unknown): UiField | null {
  if (!isObj(v) || typeof v.name !== 'string' || !ID.test(v.name) || !KINDS.includes(v.kind as string)) return null;
  const label = str(v.label, 120); if (!label) return null;
  let options: string[] | undefined;
  if (v.kind === 'select') {
    const o = arr(v.options); if (!o || !o.every((x) => str(x, 120))) return null;
    options = o as string[];
  }
  const placeholder = optStr(v.placeholder); if (placeholder === null) return null;
  return { name: v.name, label, kind: v.kind as UiField['kind'], required: v.required === true, ...(placeholder ? { placeholder } : {}), ...(options ? { options } : {}) };
}

function block(v: unknown): UiBlock | null {
  if (!isObj(v) || typeof v.id !== 'string' || !ID.test(v.id) || !UI_BLOCK_TYPES.includes(v.type as UiBlockType)) return null;
  const title = optStr(v.title), body = optStr(v.body);
  if (title === null || body === null) return null;
  const base = { id: v.id, ...(title ? { title } : {}), ...(body ? { body } : {}) };
  switch (v.type) {
    case 'clarification': {
      const q = str(v.question); if (!q) return null;
      const a = v.actions === undefined ? undefined : actions(v.actions);
      if (a === null) return null;
      return { ...base, type: 'clarification', question: q, ...(a ? { actions: a } : {}) };
    }
    case 'choice': { const o = actions(v.options); return o && o.length ? { ...base, type: 'choice', options: o } : null; }
    case 'form': {
      const f = arr(v.fields); const s = action(v.submit);
      if (!f || !s || !f.length) return null;
      const fields = f.map(field); if (!fields.every(Boolean)) return null;
      return { ...base, type: 'form', fields: fields as UiField[], submit: s };
    }
    case 'approval': {
      const a = str(v.action, 200), ap = action(v.approve), rj = action(v.reject);
      if (!a || !ap || !rj || !RISKS.includes(v.risk as string) || typeof v.reversible !== 'boolean') return null;
      return { ...base, type: 'approval', action: a, risk: v.risk as Risk, reversible: v.reversible, approve: ap, reject: rj };
    }
    case 'progress': {
      const s = arr(v.stages); if (!s || !s.length) return null;
      const stages = s.map((x) => isObj(x) && STAGES.includes(x.stage as string) && str(x.label, 80) && typeof x.done === 'boolean'
        ? { stage: x.stage as LifecycleStage, label: x.label as string, done: x.done, active: x.active === true } : null);
      return stages.every(Boolean) ? { ...base, type: 'progress', stages: stages as never } : null;
    }
    case 'evidence': {
      const i = arr(v.items); if (!i || !VSTAT.includes(v.status as string)) return null;
      const items = i.map((x) => isObj(x) && str(x.label, 120) && str(x.value, 500) ? { label: x.label as string, value: x.value as string } : null);
      return items.every(Boolean) ? { ...base, type: 'evidence', status: v.status as VerificationStatus, items: items as never } : null;
    }
    case 'notice':
      return ['info', 'warning', 'error', 'success'].includes(v.tone as string) ? { ...base, type: 'notice', tone: v.tone as never } : null;
  }
  return null;
}

/** Validate untrusted input. Returns null if anything is invalid (fail closed). */
export function parseUiSchema(input: unknown): UiSchema | null {
  let v = input;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return null; } }
  if (!isObj(v) || v.version !== 1 || !Array.isArray(v.blocks) || !v.blocks.length || v.blocks.length > MAX_BLOCKS) return null;
  const blocks = v.blocks.map(block);
  if (!blocks.every(Boolean)) return null;
  const ids = new Set(blocks.map((b) => b!.id));
  if (ids.size !== blocks.length) return null;
  return { version: 1, blocks: blocks as UiBlock[] };
}

/** Extract ```tivo-ui fenced blocks from a Brain message. */
export function extractUiSchemas(text: string): { text: string; schemas: UiSchema[] } {
  const schemas: UiSchema[] = [];
  const cleaned = text.replace(/```tivo-ui\s*\n([\s\S]*?)```/g, (_m, json: string) => {
    const s = parseUiSchema(json.trim());
    if (s) schemas.push(s);
    return '';
  });
  return { text: cleaned.trim(), schemas };
}
