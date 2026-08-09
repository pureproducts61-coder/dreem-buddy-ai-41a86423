/**
 * Mobile → computer execution loop.
 *
 *   UNDERSTAND → CHECK ENVIRONMENT → CHECK CAPABILITY → CHECK PERMISSION
 *   → EXECUTE → VERIFY → REPORT
 *
 * The phone routes a tool through the Tool Router, creates an owned, expiring,
 * idempotent command row; the target computer (the one running the Desktop
 * Bridge) picks it up, re-checks capability + permission locally, executes
 * through the Bridge, verifies the result and writes the outcome back plus a
 * structured execution-history record.
 */
import { supabase } from '@/integrations/supabase/client';
import { bridgeCall, isPermitted, requestPermission, type BridgeCapability } from './desktopBridge';
import { getBridgeMonitorState } from './bridgeMonitor';
import { isCapabilityReady } from './capabilities';
import { deviceId, getDevices, isRevoked } from './deviceRegistry';
import { getTool, routeTool, type ToolSpec } from './toolRouter';
import { recordPermissionUse } from './permissionAudit';

export type CommandStatus =
  | 'queued' | 'authorized' | 'dispatched' | 'executing' | 'verifying'
  | 'completed' | 'failed' | 'blocked' | 'cancelled' | 'expired' | 'offline';

export interface DeviceCommand {
  id: string;
  target_device_id: string;
  source_device_id: string | null;
  tool: string | null;
  capability: string;
  action: string;
  payload: Record<string, unknown>;
  status: CommandStatus;
  progress: string | null;
  result: unknown;
  verification: unknown;
  error: string | null;
  destructive: boolean;
  idempotency_key: string | null;
  attempts: number;
  max_attempts: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

const EXEC_TIMEOUT_MS = 60_000;
const DEFAULT_TTL_MS = 15 * 60_000;
const OUTBOX_KEY = 'tivo-os-command-outbox';

async function uid() {
  try { return (await supabase.auth.getUser()).data.user?.id ?? null; } catch { return null; }
}

/* ---------------- offline outbox ---------------- */

interface OutboxItem {
  idempotency_key: string;
  body: Record<string, unknown>;
  attempts: number;
  nextAt: number;
  destructive: boolean;
}

const readOutbox = (): OutboxItem[] => {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { return []; }
};
const writeOutbox = (list: OutboxItem[]) => {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(list)); } catch { /* quota */ }
};
export const pendingOutbox = () => readOutbox();

/** Retries queued commands that could not reach the database, with backoff. */
export async function flushOutbox(): Promise<number> {
  const now = Date.now();
  const list = readOutbox();
  const keep: OutboxItem[] = [];
  let sent = 0;
  for (const item of list) {
    if (item.nextAt > now) { keep.push(item); continue; }
    // Destructive commands are never silently replayed after a reconnect.
    if (item.destructive) continue;
    const { error } = await supabase.from('device_commands').insert(item.body as never);
    if (error && !/duplicate key/i.test(error.message)) {
      const attempts = item.attempts + 1;
      if (attempts < 6) keep.push({ ...item, attempts, nextAt: now + Math.min(2 ** attempts * 5000, 300_000) });
      continue;
    }
    sent += 1;
  }
  writeOutbox(keep);
  return sent;
}

/* ---------------- dispatch (phone side) ---------------- */

export interface DispatchResult {
  ok: boolean;
  commandId: string | null;
  status: CommandStatus;
  message: string;
}

/**
 * Full pipeline entry point. Understands the request, routes it to a tool and
 * device, checks permission and creates an authorized command.
 */
export async function dispatchTool(
  toolId: string,
  payload: Record<string, unknown> = {},
  opts: { deviceId?: string; ttlMs?: number; idempotencyKey?: string; confirmedDestructive?: boolean } = {},
): Promise<DispatchResult> {
  const user = await uid();
  if (!user) return { ok: false, commandId: null, status: 'blocked', message: 'Sign in first so I know which computer is yours.' };

  const route = routeTool(toolId, { preferDeviceId: opts.deviceId });
  if (!route.ok || !route.tool) {
    return {
      ok: false, commandId: null,
      status: route.failure === 'device-offline' ? 'offline' : 'blocked',
      message: route.reason,
    };
  }
  const tool = route.tool;
  if (tool.destructive && !opts.confirmedDestructive) {
    return { ok: false, commandId: null, status: 'blocked', message: `"${tool.label}" changes your computer, so I need your confirmation first.` };
  }

  const idempotency_key = opts.idempotencyKey || crypto.randomUUID();
  const body = {
    user_id: user,
    target_device_id: route.device?.device_id || deviceId(),
    source_device_id: deviceId(),
    tool: tool.id,
    capability: tool.permission,
    action: tool.action,
    payload: payload as never,
    destructive: Boolean(tool.destructive),
    idempotency_key,
    status: 'authorized',
    authorized_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + (opts.ttlMs ?? DEFAULT_TTL_MS)).toISOString(),
  };

  const { data, error } = await supabase.from('device_commands').insert(body as never).select('id').single();
  if (error || !data) {
    if (!tool.destructive) {
      writeOutbox([...readOutbox(), { idempotency_key, body, attempts: 0, nextAt: Date.now() + 5000, destructive: false }]);
      return { ok: true, commandId: null, status: 'offline', message: `I could not reach the network, so I saved "${tool.label}" and will send it as soon as you are back online.` };
    }
    return { ok: false, commandId: null, status: 'failed', message: 'I could not reach your computer through the network.' };
  }
  return { ok: true, commandId: (data as { id: string }).id, status: 'authorized', message: route.reason };
}

/** Backwards-compatible raw queue (used by older call sites). */
export async function sendCommand(opts: {
  targetDeviceId: string;
  capability: BridgeCapability;
  action: string;
  payload?: Record<string, unknown>;
}): Promise<string> {
  const user = await uid();
  if (!user) throw new Error('Sign in first so I know which computer is yours.');
  const target = getDevices().find((d) => d.device_id === opts.targetDeviceId);
  if (!target) throw new Error('That device has never connected to your account.');
  if ((target as { revoked?: boolean }).revoked) throw new Error('That device has been revoked.');
  if (!target.online) throw new Error(`${target.name} is offline right now, so I cannot run that there.`);

  const { data, error } = await supabase.from('device_commands').insert({
    user_id: user,
    target_device_id: opts.targetDeviceId,
    source_device_id: deviceId(),
    capability: opts.capability,
    action: opts.action,
    payload: (opts.payload || {}) as never,
    idempotency_key: crypto.randomUUID(),
    status: 'authorized',
    expires_at: new Date(Date.now() + DEFAULT_TTL_MS).toISOString(),
  } as never).select('id').single();
  if (error || !data) throw new Error('I could not reach your computer through the network.');
  return (data as { id: string }).id;
}

/* ---------------- live status (phone side) ---------------- */

export function watchCommand(id: string, onChange: (c: DeviceCommand) => void) {
  const channel = supabase
    .channel(`cmd-${id}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'device_commands', filter: `id=eq.${id}` },
      (p) => onChange(p.new as unknown as DeviceCommand))
    .subscribe();
  const poll = setInterval(async () => {
    const { data } = await supabase.from('device_commands').select('*').eq('id', id).maybeSingle();
    if (data) onChange(data as unknown as DeviceCommand);
  }, 4000);
  return () => { clearInterval(poll); supabase.removeChannel(channel); };
}

export async function cancelCommand(id: string) {
  await supabase.from('device_commands')
    .update({ status: 'cancelled', progress: 'Cancelled by you' } as never)
    .eq('id', id).in('status', ['queued', 'authorized', 'dispatched', 'executing']);
}

export async function commandHistory(commandId: string) {
  const { data } = await supabase.from('command_executions')
    .select('*').eq('command_id', commandId).order('created_at', { ascending: true });
  return data || [];
}

/* ---------------- execution (computer side) ---------------- */

async function patch(id: string, fields: Record<string, unknown>) {
  await supabase.from('device_commands').update(fields as never).eq('id', id)
    .then(() => undefined, () => undefined);
}

async function history(cmd: DeviceCommand, fields: {
  status: CommandStatus; permission_result: string; verification?: unknown;
  failure_reason?: string; result_summary?: string; duration_ms?: number;
}) {
  const user = await uid();
  if (!user) return;
  await supabase.from('command_executions').insert({
    command_id: cmd.id,
    user_id: user,
    target_device_id: cmd.target_device_id,
    tool: cmd.tool,
    capability: cmd.capability,
    action: cmd.action,
    attempt: (cmd.attempts || 0) + 1,
    ...fields,
  } as never).then(() => undefined, () => undefined);
}

/** Idempotency guard — a command is never executed twice on this machine. */
const executed = new Set<string>();

async function execute(cmd: DeviceCommand) {
  if (executed.has(cmd.id)) return;
  executed.add(cmd.id);
  const started = Date.now();
  const capability = cmd.capability as BridgeCapability;
  const tool: ToolSpec | null = cmd.tool ? getTool(cmd.tool) : null;

  // EXPIRY
  if (cmd.expires_at && Date.parse(cmd.expires_at) < Date.now()) {
    await patch(cmd.id, { status: 'expired', error: 'This request waited too long, so I did not run it.' });
    await history(cmd, { status: 'expired', permission_result: 'not-evaluated', failure_reason: 'expired' });
    return;
  }
  if (cmd.attempts >= (cmd.max_attempts || 3)) {
    await patch(cmd.id, { status: 'failed', error: 'I tried this several times and it kept failing, so I stopped.' });
    await history(cmd, { status: 'failed', permission_result: 'n/a', failure_reason: 'max attempts reached' });
    return;
  }

  await patch(cmd.id, {
    status: 'executing', attempts: (cmd.attempts || 0) + 1,
    dispatched_at: new Date().toISOString(), progress: 'Checking your computer…',
  });

  // CHECK ENVIRONMENT
  if (getBridgeMonitorState().state !== 'connected') {
    await patch(cmd.id, { status: 'failed', error: 'The Desktop Bridge stopped responding, so I stopped safely.' });
    await history(cmd, { status: 'failed', permission_result: 'not-evaluated', failure_reason: 'bridge unavailable' });
    executed.delete(cmd.id);
    return;
  }

  // CHECK CAPABILITY
  const capabilityId = tool?.capabilityId || 'desktop-bridge';
  if (!isCapabilityReady(capabilityId)) {
    await patch(cmd.id, { status: 'failed', error: `This computer does not report "${capabilityId}" as ready, so I cannot run that here.` });
    await history(cmd, { status: 'failed', permission_result: 'not-evaluated', failure_reason: `capability ${capabilityId} unavailable` });
    executed.delete(cmd.id);
    return;
  }

  // CHECK PERMISSION (enforced here, at the execution boundary — not in the UI)
  if (!isPermitted(capability)) {
    requestPermission(capability, `Requested from your phone for "${cmd.action}"`);
    await patch(cmd.id, {
      status: 'blocked',
      error: `I need permission for "${capability}" on the computer before I can continue.`,
    });
    await history(cmd, { status: 'blocked', permission_result: 'blocked', failure_reason: 'permission not granted' });
    return;
  }
  recordPermissionUse({ capability, action: cmd.action, allowed: true, reason: `Remote command from ${cmd.source_device_id || 'another device'}` });

  // EXECUTE
  await patch(cmd.id, { progress: 'Running the step on your computer…' });
  try {
    const result = await Promise.race([
      bridgeCall<unknown>(capability, cmd.action, cmd.payload || {}),
      new Promise((_, reject) => setTimeout(() => reject(new Error('The step took too long, so I stopped it.')), EXEC_TIMEOUT_MS)),
    ]);

    // VERIFY
    await patch(cmd.id, { status: 'verifying', progress: 'Checking the result…' });
    const verdict = tool?.verify
      ? tool.verify(result)
      : { ok: !result || typeof result !== 'object' || (result as { ok?: boolean }).ok !== false, detail: 'Bridge response checked' };

    // REPORT
    if (verdict.ok) {
      await patch(cmd.id, {
        status: 'completed', progress: 'Finished and verified', result: result as never,
        verification: verdict as never, error: null, completed_at: new Date().toISOString(),
      });
      await history(cmd, {
        status: 'completed', permission_result: 'allowed', verification: verdict,
        result_summary: verdict.detail, duration_ms: Date.now() - started,
      });
    } else {
      await patch(cmd.id, { status: 'failed', verification: verdict as never, error: verdict.detail, completed_at: new Date().toISOString() });
      await history(cmd, { status: 'failed', permission_result: 'allowed', verification: verdict, failure_reason: verdict.detail, duration_ms: Date.now() - started });
    }
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'The step could not be completed on your computer.';
    const retryable = !cmd.destructive && (cmd.attempts || 0) + 1 < (cmd.max_attempts || 3);
    await patch(cmd.id, {
      status: retryable ? 'queued' : 'failed',
      progress: retryable ? 'That attempt failed — I will try again shortly.' : null,
      error: reason,
      completed_at: retryable ? null : new Date().toISOString(),
    });
    await history(cmd, { status: retryable ? 'queued' : 'failed', permission_result: 'allowed', failure_reason: reason, duration_ms: Date.now() - started });
    if (retryable) executed.delete(cmd.id);
  }
}

let hosting = false;

/** Runs on the device that owns the Bridge. Executes commands addressed to it. */
export async function startCommandHost() {
  if (hosting) return;
  hosting = true;
  const user = await uid();
  if (!user) { hosting = false; return; }
  const me = deviceId();
  let busy = false;

  const drain = async () => {
    if (busy) return;
    if (await isRevoked()) return;          // a revoked device stops accepting work
    busy = true;
    try {
      const { data } = await supabase.from('device_commands')
        .select('*')
        .eq('user_id', user).eq('target_device_id', me)
        .in('status', ['queued', 'authorized', 'dispatched'])
        .order('created_at', { ascending: true }).limit(5);
      for (const row of (data || []) as unknown as DeviceCommand[]) await execute(row);
    } catch { /* offline — retry on the next tick */ }
    busy = false;
  };

  try {
    supabase.channel(`cmd-host-${me}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'device_commands', filter: `target_device_id=eq.${me}` },
        () => { void drain(); })
      .subscribe();
  } catch { /* realtime unavailable */ }

  void drain();
  setInterval(() => { void drain(); }, 15_000);
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { void flushOutbox().then(() => drain()); });
  }
}
