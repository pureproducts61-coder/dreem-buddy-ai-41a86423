/**
 * Tool Router — the single place that decides WHICH tool on WHICH device can
 * satisfy a request. Tools are registered declaratively (plugins can add more
 * at runtime) so the router never becomes a giant switch statement.
 */
import { getCapabilities, isCapabilityReady } from './capabilities';
import { deviceId, getDevices, type DeviceRow } from './deviceRegistry';
import { permissionStatus, type BridgeCapability } from './desktopBridge';
import { getBridgeMonitorState } from './bridgeMonitor';

export interface ToolSpec {
  id: string;
  label: string;
  /** capability id in the Capability Registry (e.g. "filesystem", "terminal") */
  capabilityId: string;
  /** bridge permission this tool consumes */
  permission: BridgeCapability;
  /** Bridge action name invoked on the target machine */
  action: string;
  /** true when the effect cannot be undone — never auto-replayed after reconnect */
  destructive?: boolean;
  /** devices that may host this tool */
  roles?: ('desktop' | 'mobile')[];
  /** optional runtime verification of the Bridge response */
  verify?: (result: unknown) => { ok: boolean; detail: string };
}

const tools = new Map<string, ToolSpec>();

export function registerTool(spec: ToolSpec) { tools.set(spec.id, spec); }
export function unregisterTool(id: string) { tools.delete(id); }
export function listTools(): ToolSpec[] { return [...tools.values()]; }
export function getTool(id: string) { return tools.get(id) ?? null; }

const okObject = (result: unknown) => {
  const ok = !result || typeof result !== 'object' || (result as { ok?: boolean }).ok !== false;
  return { ok, detail: ok ? 'The computer confirmed the step finished.' : 'The computer reported the step did not complete.' };
};

/** Built-in tools. Every one of them maps to a real Bridge action + permission. */
const BUILT_IN: ToolSpec[] = [
  { id: 'files.list', label: 'List files', capabilityId: 'filesystem', permission: 'files.read', action: 'files.list', roles: ['desktop'] },
  { id: 'files.read', label: 'Read a file', capabilityId: 'filesystem', permission: 'files.read', action: 'files.read', roles: ['desktop'] },
  { id: 'files.write', label: 'Write a file', capabilityId: 'filesystem', permission: 'files.write', action: 'files.write', destructive: true, roles: ['desktop'] },
  { id: 'files.delete', label: 'Delete a file', capabilityId: 'filesystem', permission: 'files.write', action: 'files.delete', destructive: true, roles: ['desktop'] },
  { id: 'terminal.run', label: 'Run a terminal command', capabilityId: 'terminal', permission: 'terminal.run', action: 'terminal.run', destructive: true, roles: ['desktop'] },
  { id: 'apps.launch', label: 'Open an application', capabilityId: 'apps', permission: 'apps.launch', action: 'apps.launch', roles: ['desktop'] },
  { id: 'apps.close', label: 'Close an application', capabilityId: 'apps', permission: 'apps.launch', action: 'apps.close', destructive: true, roles: ['desktop'] },
  { id: 'screen.capture', label: 'See the screen', capabilityId: 'vision', permission: 'screen.capture', action: 'screen.capture' },
  { id: 'input.type', label: 'Type on the keyboard', capabilityId: 'keyboard', permission: 'input.control', action: 'input.type', destructive: true, roles: ['desktop'] },
  { id: 'input.click', label: 'Click the mouse', capabilityId: 'mouse', permission: 'input.control', action: 'input.click', destructive: true, roles: ['desktop'] },
  { id: 'clipboard.read', label: 'Read the clipboard', capabilityId: 'clipboard', permission: 'clipboard', action: 'clipboard.read' },
  { id: 'clipboard.write', label: 'Write the clipboard', capabilityId: 'clipboard', permission: 'clipboard', action: 'clipboard.write' },
  { id: 'browser.open', label: 'Open a page in the browser', capabilityId: 'browser', permission: 'browser.control', action: 'browser.open', roles: ['desktop'] },
  { id: 'system.info', label: 'Read system information', capabilityId: 'cpu', permission: 'system.info', action: 'system.info' },
  { id: 'notifications.show', label: 'Show a desktop notification', capabilityId: 'desktop-bridge', permission: 'notifications', action: 'notifications.show' },
];
BUILT_IN.forEach((t) => registerTool({ verify: okObject, ...t }));

export type RouteFailure =
  | 'no-tool' | 'no-device' | 'device-offline' | 'device-untrusted'
  | 'capability-unavailable' | 'permission-blocked' | 'permission-required';

export interface RouteDecision {
  ok: boolean;
  tool: ToolSpec | null;
  device: DeviceRow | null;
  /** true when the chosen device is this one (execute directly, no queue) */
  local: boolean;
  failure?: RouteFailure;
  reason: string;
}

function deviceHasCapability(d: DeviceRow, capabilityId: string) {
  return (d.capabilities || []).some((c) => c.id === capabilityId && c.state === 'ready');
}

function devicePermits(d: DeviceRow, permission: string) {
  const p = (d.permissions || []).find((x) => x.capability === permission);
  return p?.granted === true;
}

/**
 * Chooses tool + device for a request.
 * Preference: this device (no network hop) → a trusted online desktop → any trusted online device.
 */
export function routeTool(toolId: string, opts: { preferDeviceId?: string } = {}): RouteDecision {
  const tool = getTool(toolId);
  if (!tool) return { ok: false, tool: null, device: null, local: false, failure: 'no-tool', reason: `I do not have a tool called "${toolId}".` };

  const me = deviceId();
  const all = getDevices().filter((d) => !(d as DeviceRow & { revoked?: boolean }).revoked);
  const candidates = all.filter((d) => (!tool.roles || tool.roles.includes(d.role as 'desktop' | 'mobile')));

  // 1. this device, if it can really do it right now
  const localReady = isCapabilityReady(tool.capabilityId)
    && (tool.roles ? tool.roles.includes(getDevices().find((d) => d.device_id === me)?.role as 'desktop' | 'mobile' || 'desktop') : true);
  if (!opts.preferDeviceId || opts.preferDeviceId === me) {
    const status = permissionStatus(tool.permission);
    if (localReady && status === 'enabled' && getBridgeMonitorState().state === 'connected') {
      return { ok: true, tool, device: all.find((d) => d.device_id === me) ?? null, local: true, reason: `Running "${tool.label}" on this device.` };
    }
  }

  const pool = opts.preferDeviceId
    ? candidates.filter((d) => d.device_id === opts.preferDeviceId)
    : candidates.filter((d) => d.device_id !== me);

  if (!pool.length) {
    return { ok: false, tool, device: null, local: false, failure: 'no-device', reason: `No device on your account can run "${tool.label}" yet.` };
  }

  const trusted = pool.filter((d) => (d as DeviceRow & { trusted?: boolean }).trusted !== false);
  if (!trusted.length) {
    return { ok: false, tool, device: pool[0], local: false, failure: 'device-untrusted', reason: `${pool[0].name} is not a trusted device yet. Pair it first.` };
  }

  const online = trusted.filter((d) => d.online);
  if (!online.length) {
    return { ok: false, tool, device: trusted[0], local: false, failure: 'device-offline', reason: `${trusted[0].name} is offline right now.` };
  }

  const capable = online.filter((d) => deviceHasCapability(d, tool.capabilityId));
  if (!capable.length) {
    return { ok: false, tool, device: online[0], local: false, failure: 'capability-unavailable', reason: `${online[0].name} does not report "${tool.capabilityId}" as ready — the Desktop Bridge may not be running there.` };
  }

  const permitted = capable.filter((d) => devicePermits(d, tool.permission));
  if (!permitted.length) {
    return { ok: false, tool, device: capable[0], local: false, failure: 'permission-required', reason: `"${tool.permission}" is not switched on for ${capable[0].name}. Turn it on there, then ask me again.` };
  }

  const pick = permitted.find((d) => d.role === 'desktop') || permitted[0];
  return { ok: true, tool, device: pick, local: pick.device_id === me, reason: `Using ${pick.name} for "${tool.label}".` };
}

/** Human-readable list injected into the system prompt so the AI never invents tools. */
export function toolsPromptBlock(): string {
  const caps = new Map(getCapabilities().map((c) => [c.id, c.state]));
  return listTools()
    .map((t) => `- ${t.id} (${t.label}) → capability ${t.capabilityId}: ${caps.get(t.capabilityId) || 'unknown'}${t.destructive ? ' [needs confirmation]' : ''}`)
    .join('\n');
}
