/**
 * AI Constitution — the single dynamic source of truth for TIVO's behaviour.
 * Nothing here is hardcoded in prompts: the runtime prompt is composed from
 * enabled entries every time, so edits apply instantly with no restart.
 */
import { LocalRegistry } from './registry';

export const CONSTITUTION_SECTIONS = [
  'identity',
  'rules',
  'knowledge',
  'behaviour',
  'prompt-templates',
  'system-prompts',
  'memory-rules',
  'skills',
  'variables',
  'custom-instructions',
  'capabilities',
  'execution-policies',
  'safety-rules',
  'learning-rules',
] as const;

export type ConstitutionSection = typeof CONSTITUTION_SECTIONS[number];

export interface ConstitutionEntry {
  id: string;
  [key: string]: unknown;
  section: ConstitutionSection;
  title: string;
  content: string;
  enabled: boolean;
  priority: number;
  tags: string[];
  projectId?: string | null;   // per-project override
  updatedAt: string;
}

const seedEntry = (
  section: ConstitutionSection, title: string, content: string, priority = 50,
): ConstitutionEntry => ({
  id: `${section}:${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  section, title, content, enabled: true, priority, tags: [], projectId: null,
  updatedAt: new Date().toISOString(),
});

const SEED: ConstitutionEntry[] = [
  seedEntry('identity', 'Who I am',
    'I am TIVO, a local-first AI operating system assistant. I speak like a calm, expert human colleague — never robotic. I answer in the user\'s language (Bangla by default).', 10),
  seedEntry('behaviour', 'Human execution voice',
    'Never emit robotic status words like "Planning...", "Thinking...", "Searching...". Narrate work as a person would: "I understand what you want.", "I am checking your computer now.", "I found the app and I am opening it.", "I need your permission before continuing.", "That step is done — moving to the next one."', 15),
  seedEntry('rules', 'Truthful capability',
    'Only claim abilities that are actually available right now. If something is blocked (missing Desktop Bridge, missing permission, missing model), say so plainly and explain exactly what would unblock it.', 20),
  seedEntry('safety-rules', 'Permission before action',
    'Never touch the filesystem, terminal, input devices or screen without an explicitly granted Bridge permission. Ask once, act after approval, report the result.', 5),
  seedEntry('execution-policies', 'Step discipline',
    'Work in visible steps: understand → check environment → act → verify → report. Stop and ask when a step would be destructive or irreversible.', 25),
  seedEntry('memory-rules', 'What to remember',
    'Persist user preferences, project mission, decisions and rejected approaches. Do not persist secrets or credentials in memory entries.', 30),
  seedEntry('learning-rules', 'Improve over time',
    'After each completed task, store a short lesson (what worked, what failed) in project memory so future runs are faster.', 40),
  seedEntry('capabilities', 'Local capabilities',
    'Local models, offline chat/memory/history, screen vision via the Bridge, file and app control through granted Bridge permissions, plugin extensions.', 35),
];

export const constitution = new LocalRegistry<ConstitutionEntry>('tivo-os-constitution', SEED);

export function upsertEntry(entry: Partial<ConstitutionEntry> & { section: ConstitutionSection; title: string; content: string }) {
  const existing = entry.id ? constitution.get(entry.id) : null;
  if (existing) {
    constitution.update(existing.id, { ...entry, updatedAt: new Date().toISOString() });
    return existing.id;
  }
  return constitution.add({
    section: entry.section,
    title: entry.title,
    content: entry.content,
    enabled: entry.enabled ?? true,
    priority: entry.priority ?? 50,
    tags: entry.tags ?? [],
    projectId: entry.projectId ?? null,
    updatedAt: new Date().toISOString(),
  } as Omit<ConstitutionEntry, 'id'>).id;
}

export function searchConstitution(query: string, section?: ConstitutionSection) {
  const q = query.trim().toLowerCase();
  return constitution.getAll().filter((e) => {
    if (section && e.section !== section) return false;
    if (!q) return true;
    return e.title.toLowerCase().includes(q)
      || e.content.toLowerCase().includes(q)
      || e.tags.some((t) => t.toLowerCase().includes(q));
  });
}

/** Simple {{variable}} interpolation from the `variables` section. */
export function resolveVariables(text: string): string {
  const vars = constitution.getAll().filter((e) => e.section === 'variables' && e.enabled);
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, key) => {
    const hit = vars.find((v) => v.title === key);
    return hit ? hit.content : m;
  });
}

/**
 * Compose the live system prompt. Called on every request, so any edit in the
 * admin Constitution UI takes effect on the very next message.
 */
export function buildSystemPrompt(opts: { projectId?: string | null; extraContext?: string } = {}): string {
  const { projectId = null, extraContext } = opts;
  const entries = constitution.getAll()
    .filter((e) => e.enabled)
    .filter((e) => !e.projectId || e.projectId === projectId)
    .filter((e) => e.section !== 'variables')
    .sort((a, b) => a.priority - b.priority || a.section.localeCompare(b.section));

  const bySection = new Map<string, ConstitutionEntry[]>();
  entries.forEach((e) => {
    const list = bySection.get(e.section) || [];
    list.push(e);
    bySection.set(e.section, list);
  });

  const blocks: string[] = [];
  for (const [section, list] of bySection) {
    blocks.push(`## ${section.replace(/-/g, ' ').toUpperCase()}\n${list.map((e) => `- ${e.title}: ${e.content}`).join('\n')}`);
  }
  if (extraContext) blocks.push(`## RUNTIME CONTEXT\n${extraContext}`);
  return resolveVariables(blocks.join('\n\n'));
}

export function constitutionRevision(): string {
  const all = constitution.getAll();
  return `${all.length}:${all.reduce((s, e) => s + String(e.updatedAt).length + e.content.length, 0)}`;
}