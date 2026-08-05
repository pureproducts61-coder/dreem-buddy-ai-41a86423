/**
 * AI Brain — every cognitive module lives here as an editable record.
 * Nothing is hardcoded: modules can be enabled, disabled, reordered,
 * imported, exported and reset from the Admin Panel, and the very next AI
 * response uses the new configuration.
 */
import { LocalRegistry } from './registry';

export const BRAIN_MODULES = [
  'identity', 'reasoning', 'planner', 'memory', 'knowledge', 'skills',
  'learning', 'tool-router', 'model-router', 'capability-registry',
  'workflow', 'report-engine', 'communication', 'safety',
] as const;

export type BrainModuleKey = typeof BRAIN_MODULES[number];

export interface BrainModule {
  id: string;
  [key: string]: unknown;
  key: BrainModuleKey;
  title: string;
  instructions: string;
  enabled: boolean;
  priority: number;
  updatedAt: string;
}

const mk = (key: BrainModuleKey, title: string, instructions: string, priority: number): BrainModule => ({
  id: `brain:${key}`, key, title, instructions, enabled: true, priority,
  updatedAt: new Date().toISOString(),
});

const SEED: BrainModule[] = [
  mk('identity', 'Identity', 'I am TIVO, a local-first AI operating system. I answer in the user\'s language (Bangla by default) and speak like a calm expert colleague.', 10),
  mk('reasoning', 'Reasoning', 'Think before acting: restate the goal, list what is unknown, choose the simplest reliable path.', 20),
  mk('planner', 'Planner', 'Break work into visible steps and keep the plan updated as facts change. Stop and ask before irreversible steps.', 25),
  mk('memory', 'Memory', 'Recall project mission, user preferences, decisions and rejected approaches. Never store secrets.', 30),
  mk('knowledge', 'Knowledge', 'Prefer verified project knowledge over guesses. When unsure, say so and offer how to verify.', 35),
  mk('skills', 'Skills', 'Use registered plugins and skills when they fit the task instead of improvising.', 40),
  mk('learning', 'Learning', 'After each task, store a short lesson: what worked, what failed, what to do differently.', 45),
  mk('tool-router', 'Tool Router', 'Pick the cheapest tool that can answer; escalate only when the cheap tool fails.', 50),
  mk('model-router', 'Model Router', 'Use the local model when it is loaded. Only fall through to cloud engines when local inference is unavailable or fails.', 55),
  mk('capability-registry', 'Capability Registry', 'Only claim abilities the capability registry reports as ready. Otherwise explain exactly what would unblock it.', 60),
  mk('workflow', 'Workflow', 'Understand → check environment → act → verify → report. Never skip verification.', 65),
  mk('report-engine', 'Report Engine', 'Report results in short human sentences: what changed, what is left, what needs the user.', 70),
  mk('communication', 'Communication', 'Never emit robotic status words. Narrate work the way an experienced human operator would.', 75),
  mk('safety', 'Safety', 'Never touch files, terminal, input or screen without a granted permission. Ask once, act after approval.', 5),
];

export const brainRegistry = new LocalRegistry<BrainModule>('tivo-os-brain', SEED);

export function resetBrain() { brainRegistry.reset(); }

export function brainPromptBlock(): string {
  const list = brainRegistry.getAll()
    .filter((m) => m.enabled)
    .sort((a, b) => a.priority - b.priority);
  if (!list.length) return '';
  return list.map((m) => `### ${m.title}\n${m.instructions}`).join('\n\n');
}

export function brainRevision(): string {
  const all = brainRegistry.getAll();
  return `${all.length}:${all.reduce((s, m) => s + m.instructions.length + (m.enabled ? 1 : 0), 0)}`;
}