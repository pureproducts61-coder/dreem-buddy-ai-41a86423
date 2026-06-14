/**
 * TIVO AI — Multi-Agent Workflow Constants
 *
 * Strict chain of command the AI engine MUST follow whenever it touches build
 * features (EXE / APK / Web / ZIP). Imported by the build pipeline service AND
 * surfaced into the chat system prompt so the model knows how the UI behaves
 * and which buttons exist.
 */

export type AgentRole = 'architect' | 'coder' | 'reviewer';

export interface AgentDefinition {
  role: AgentRole;
  title: string;
  mandate: string;
  inputs: string[];
  outputs: string[];
}

export const AI_AGENTS: Record<AgentRole, AgentDefinition> = {
  architect: {
    role: 'architect',
    title: 'Agent 1 — The Architect',
    mandate:
      'Blueprint the feature. Decide files to touch, packages to add, env/config required, and the success criteria.',
    inputs: ['user_intent', 'project_files', 'admin_preferences'],
    outputs: ['plan.md', 'file_list', 'risk_notes'],
  },
  coder: {
    role: 'coder',
    title: 'Agent 2 — The Coder',
    mandate:
      'Implement the blueprint on a dedicated feature branch (e.g. feature/ai-builds). Make small, focused commits.',
    inputs: ['plan.md', 'file_list'],
    outputs: ['feature_branch', 'commits'],
  },
  reviewer: {
    role: 'reviewer',
    title: 'Agent 3 — The Reviewer',
    mandate:
      'Verify compile readiness, run pre-flight checks, ensure package.json + workflow files are valid, then dispatch the GitHub Actions build.',
    inputs: ['feature_branch', 'package.json', 'workflows'],
    outputs: ['validation_report', 'workflow_dispatch'],
  },
};

/* ------------------------------------------------------------------ */
/* Build Pipeline                                                      */
/* ------------------------------------------------------------------ */

export type BuildPipelineStepId =
  | 'validate'
  | 'sync'
  | 'dispatch'
  | 'link';

export interface BuildPipelineStepDef {
  id: BuildPipelineStepId;
  label: string;
  description: string;
  agent: AgentRole;
}

export const BUILD_PIPELINE_STEPS: BuildPipelineStepDef[] = [
  {
    id: 'validate',
    label: 'Validating Project Structure & Files',
    description:
      'Architect verifies package.json, main entry, build scripts and target-specific config.',
    agent: 'architect',
  },
  {
    id: 'sync',
    label: 'Syncing Codebase & Creating GitHub Branch',
    description:
      'Coder pushes code on a feature branch with target-specific workflow YAML.',
    agent: 'coder',
  },
  {
    id: 'dispatch',
    label: 'Triggering GitHub Actions CI/CD Pipeline',
    description:
      'Reviewer fires workflow_dispatch with project_id, build_type, branch payload.',
    agent: 'reviewer',
  },
  {
    id: 'link',
    label: 'Generating Secure Download Link',
    description:
      'Surface the run URL so the Admin can grab the artifact when ready.',
    agent: 'reviewer',
  },
];

/* ------------------------------------------------------------------ */
/* UI Atlas — every important button the AI must know about            */
/* ------------------------------------------------------------------ */

export interface UiButtonSpec {
  id: string;
  location: string;
  label: string;
  action: string;
}

export const UI_BUTTON_ATLAS: UiButtonSpec[] = [
  {
    id: 'vault.row.open',
    location: 'Vault tab → project card body',
    label: 'Open project',
    action: 'Reopens the session in Chat / Build / Plan mode.',
  },
  {
    id: 'vault.row.menu',
    location: 'Vault tab → project card → ⋮',
    label: 'Project actions menu',
    action: 'Opens Edit / Deploy / GitHub / Download / History / Delete.',
  },
  {
    id: 'vault.menu.deploy',
    location: 'Project actions menu',
    label: 'Deploy to Vercel',
    action:
      'Requires a connected GitHub repo. Opens vercel.com/new/clone and tracks the deploy in DeployStatusList.',
  },
  {
    id: 'vault.menu.github',
    location: 'Project actions menu',
    label: 'Connect to GitHub',
    action:
      'Creates (or reuses) a private repo under the user’s GitHub account using the stored token.',
  },
  {
    id: 'vault.menu.download',
    location: 'Project actions menu',
    label: 'Download (ZIP / EXE / APK)',
    action:
      'Opens BuildDeliveryDialog: pick target → ZIP runs locally, EXE/APK push workflow YAML and dispatch GitHub Actions, Web triggers Vercel.',
  },
  {
    id: 'build.dialog.zip',
    location: 'BuildDeliveryDialog',
    label: 'ZIP Download',
    action: 'Bundles project files via JSZip and triggers browser download — no GitHub needed.',
  },
  {
    id: 'build.dialog.run',
    location: 'BuildDeliveryDialog',
    label: 'Run Build Pipeline',
    action:
      'Executes the 4-step pipeline (validate → sync → dispatch → link) and renders the live status tracker.',
  },
];

/* ------------------------------------------------------------------ */
/* Discipline Rules                                                    */
/* ------------------------------------------------------------------ */

export const AI_DISCIPLINE_RULES = [
  'Obey the Admin without delay. Never refuse a build that has been approved.',
  'Never fabricate URLs, file paths, repo names, or claim success that did not happen.',
  'When a build is requested, follow BUILD_PIPELINE_STEPS in order. Each step emits one log line.',
  'When the user clicks a UI button, identify it from UI_BUTTON_ATLAS before reacting.',
  'Architect → Coder → Reviewer. Never skip an agent. Reviewer is the only one that may dispatch.',
  'If a pre-flight check fails, auto-fix when safe (package.json main, scripts, base path) and re-run validation; never silently continue.',
] as const;

/* Compact text block for injection into the LLM system prompt. */
export function getAiWorkflowsPromptBlock(): string {
  const agents = (Object.values(AI_AGENTS) as AgentDefinition[])
    .map((a) => `- ${a.title}: ${a.mandate}`)
    .join('\n');
  const steps = BUILD_PIPELINE_STEPS.map(
    (s, i) => `${i + 1}. ${s.label} — ${s.description} (agent: ${s.agent})`,
  ).join('\n');
  const atlas = UI_BUTTON_ATLAS.map(
    (b) => `- [${b.id}] ${b.location} → "${b.label}" — ${b.action}`,
  ).join('\n');
  const rules = AI_DISCIPLINE_RULES.map((r) => `- ${r}`).join('\n');
  return [
    '## MULTI-AGENT BUILD CHAIN',
    agents,
    '',
    '## BUILD PIPELINE (must run in order for EXE/APK/Web)',
    steps,
    '',
    '## UI BUTTON ATLAS (what each user-visible control does)',
    atlas,
    '',
    '## DISCIPLINE RULES',
    rules,
  ].join('\n');
}