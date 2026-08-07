/**
 * System Self Test — verifies that every OS layer actually works together and
 * explains, in plain language, what to do when something is missing.
 */
import { pingBridge, isPermitted, bridgePermissions } from './desktopBridge';
import { detectCapabilities } from './capabilities';
import { detectHardware, modelRegistry } from './modelManager';
import { enabledPlugins } from './plugins';
import { probeRuntime, isLocalReady } from './localRuntime';
import { orderedEngines } from './engineRouter';
import { getWorkspaceState, bootstrapWorkspace } from './workspace';
import { selectModelFor } from './orchestrator';

export interface SelfTestResult {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  /** what to press / do next */
  action?: string;
  /** why it failed, in plain language */
  why?: string;
  /** what becomes possible once it is fixed */
  after?: string;
}

export interface SelfTestReport {
  ranAt: string;
  results: SelfTestResult[];
  passed: number;
  warnings: number;
  failures: number;
  summary: string;
}

const REPORT_KEY = 'tivo-os-selftest';

export function lastSelfTest(): SelfTestReport | null {
  try { return JSON.parse(localStorage.getItem(REPORT_KEY) || 'null'); } catch { return null; }
}

export async function runSelfTest(): Promise<SelfTestReport> {
  const r: SelfTestResult[] = [];
  const push = (x: SelfTestResult) => r.push(x);

  const health = await pingBridge();
  push({
    id: 'bridge', label: 'Desktop Bridge',
    status: health.online ? 'pass' : 'warn',
    detail: health.online ? `Connected (${health.version || 'unknown version'}, ${health.latencyMs}ms)` : 'Not running on this computer',
    action: health.online ? undefined : 'Open Desktop bridge and press "Install Desktop Bridge".',
    why: health.online ? undefined : 'The local helper service that gives TIVO access to this computer is not answering on 127.0.0.1.',
    after: health.online ? undefined : 'Files, terminal, apps, screen and input control become available.',
  });

  let runtime = false;
  try { await probeRuntime(); runtime = isLocalReady(); } catch { runtime = false; }
  push({
    id: 'runtime', label: 'Local model runtime',
    status: runtime ? 'pass' : 'warn',
    detail: runtime ? 'Local runtime is answering' : 'No local runtime detected — cloud engines will be used',
    action: runtime ? undefined : 'Install the Bridge or start Ollama / LM Studio.',
    why: runtime ? undefined : 'No local inference server responded, so answers must go to a cloud provider.',
    after: runtime ? undefined : 'Chat, reasoning and coding run fully offline on your own machine.',
  });

  const vision = await selectModelFor('vision');
  const ocr = await selectModelFor('ocr');
  push({
    id: 'vision', label: 'Vision',
    status: health.online && isPermitted('screen.capture') ? 'pass' : 'warn',
    detail: health.online
      ? isPermitted('screen.capture') ? 'Screen capture allowed through the Bridge' : 'Screen permission is off'
      : 'Only browser screen sharing is available',
    action: isPermitted('screen.capture') ? undefined : 'Turn on "See the screen" in Bridge permissions.',
    why: isPermitted('screen.capture') ? undefined : 'Screen capture permission is off, so TIVO cannot see windows, buttons or dialogs.',
    after: isPermitted('screen.capture') ? undefined : 'TIVO can read the screen and operate applications for you.',
  });
  push({
    id: 'vision-models', label: 'Vision / OCR models',
    status: vision.missing && ocr.missing ? 'warn' : 'pass',
    detail: vision.missing && ocr.missing ? 'No vision or OCR model installed' : `${vision.model?.name || ocr.model?.name} is ready`,
    action: vision.missing && ocr.missing ? 'Add a vision or OCR model in Local models (download or import GGUF).' : undefined,
    why: vision.missing && ocr.missing ? 'No installed model declares vision or OCR capability.' : undefined,
    after: vision.missing && ocr.missing ? 'Screen text reading and UI element detection start working, and the paused action retries automatically.' : undefined,
  });

  for (const [id, label, cap] of [
    ['filesystem', 'Filesystem', 'files.read'],
    ['terminal', 'Terminal', 'terminal.run'],
    ['input', 'Mouse & keyboard', 'input.control'],
    ['apps', 'Applications', 'apps.launch'],
  ] as const) {
    const granted = isPermitted(cap);
    push({
      id, label,
      status: health.online && granted ? 'pass' : 'warn',
      detail: !health.online ? 'Needs the Desktop Bridge' : granted ? 'Allowed' : 'Permission is off',
      action: health.online && !granted ? `Enable "${bridgePermissions.get(cap)?.label}" in Bridge permissions.` : undefined,
      why: !health.online ? 'This resource is exposed by the Desktop Bridge, which is not running.'
        : granted ? undefined : 'You have not granted this permission yet, so TIVO refuses to touch it.',
      after: granted ? undefined : `TIVO can use ${label.toLowerCase()} on your behalf, and every use is written to the permission audit.`,
    });
  }

  push({
    id: 'clipboard', label: 'Clipboard',
    status: navigator.clipboard ? 'pass' : 'warn',
    detail: navigator.clipboard ? 'Browser clipboard available' : 'Clipboard needs the Bridge',
  });
  push({
    id: 'browser', label: 'Browser control',
    status: enabledPlugins().some((p) => /browser/i.test(p.name) || p.kind === 'connector') ? 'pass' : 'warn',
    detail: 'Provided by a browser-automation plugin',
    action: 'Install a browser plugin from the Plugins tab if you need it.',
  });

  const hw = await detectHardware();
  push({ id: 'gpu', label: 'GPU', status: hw.gpu && hw.gpu !== 'unknown' ? 'pass' : 'warn', detail: hw.gpu || 'Not reported by this browser' });
  push({ id: 'cpu', label: 'CPU', status: 'pass', detail: `${hw.cores} logical cores` });
  push({ id: 'ram', label: 'Memory', status: hw.ramGb >= 4 ? 'pass' : 'warn', detail: `${hw.ramGb} GB reported` });

  const models = modelRegistry.getAll();
  push({
    id: 'models', label: 'Local models',
    status: models.some((m) => m.status === 'ready') ? 'pass' : 'warn',
    detail: `${models.filter((m) => m.status === 'ready').length} ready of ${models.length} registered`,
    action: models.some((m) => m.status === 'ready') ? undefined : 'Download or import a model in Local models.',
    why: models.some((m) => m.status === 'ready') ? undefined : 'No model files are fully downloaded and verified on this device.',
    after: models.some((m) => m.status === 'ready') ? undefined : 'Offline answers become possible without any cloud provider.',
  });
  push({ id: 'plugins', label: 'Plugins', status: 'pass', detail: `${enabledPlugins().length} enabled` });

  const caps = await detectCapabilities();
  push({
    id: 'capabilities', label: 'Capability registry',
    status: caps.length ? 'pass' : 'fail',
    detail: `${caps.filter((c) => c.state === 'ready').length} of ${caps.length} capabilities ready`,
  });
  push({
    id: 'permissions', label: 'Permissions',
    status: 'pass',
    detail: `${bridgePermissions.getAll().filter((p) => p.granted).length} of ${bridgePermissions.getAll().length} granted`,
  });

  let ws = getWorkspaceState();
  if (!ws) { try { ws = await bootstrapWorkspace(); } catch { ws = null; } }
  push({
    id: 'workspace', label: 'Local workspace',
    status: ws?.initialised ? 'pass' : 'fail',
    detail: ws?.initialised ? `${ws.folders.length} folders, ${ws.quotaGb.toFixed(1)} GB available${ws.persistent ? ', persistent' : ''}` : 'Workspace could not be created',
    action: ws?.initialised ? undefined : 'Press "Repair workspace" above.',
    why: ws?.initialised ? undefined : 'The local folders and IndexedDB stores could not be created (browser storage may be blocked).',
    after: ws?.initialised ? undefined : 'Projects, chats, models and settings persist offline.',
  });
  push({
    id: 'database', label: 'Offline database',
    status: ws?.stores?.length ? 'pass' : 'fail',
    detail: ws?.stores?.length ? `Stores: ${ws.stores.join(', ')}` : 'IndexedDB is unavailable',
  });
  push({
    id: 'engines', label: 'Engine router',
    status: orderedEngines().length ? 'pass' : 'fail',
    detail: orderedEngines().map((e) => e.name).join(' → '),
  });

  const report: SelfTestReport = {
    ranAt: new Date().toISOString(),
    results: r,
    passed: r.filter((x) => x.status === 'pass').length,
    warnings: r.filter((x) => x.status === 'warn').length,
    failures: r.filter((x) => x.status === 'fail').length,
    summary: '',
  };
  report.summary = report.failures
    ? `${report.failures} thing(s) need fixing before TIVO can run the computer.`
    : report.warnings
      ? `Everything essential works. ${report.warnings} optional ability is still switched off.`
      : 'Every system is ready.';
  localStorage.setItem(REPORT_KEY, JSON.stringify(report));
  return report;
}
