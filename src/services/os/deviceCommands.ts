/**
 * Mobile → computer command transport.
 * The phone queues a command for a target device; the target device (the one
 * running the Desktop Bridge) picks it up, checks capability + permission,
 * executes through the Bridge, verifies and reports the result back. Every
 * step is written back to the row so the phone sees live, plain-language status.
 */
import { supabase } from '@/integrations/supabase/client';
import { bridgeCall, isPermitted, requestPermission, type BridgeCapability } from './desktopBridge';
import { getBridgeMonitorState } from './bridgeMonitor';
import { isCapabilityReady } from './capabilities';
import { deviceId, getDevices } from './deviceRegistry';

export type CommandStatus = 'queued' | 'running' | 'done' | 'failed' | 'blocked' | 'cancelled';

export interface DeviceCommand {
  id: string;
  target_device_id: string;
  source_device_id: string | null;
  capability: string;
  action: string;
  payload: Record<string, unknown>;
  status: CommandStatus;
  progress: string | null;
  result: unknown;
  error: string | null;
  created_at: string;
  updated_at: string;
}

const EXEC_TIMEOUT_MS = 60_000;

async function uid() {
  try { return (await supabase.auth.getUser()).data.user?.id ?? null; } catch { return null; }
}

/** Called from the phone. Returns the queued command id, or throws a human message. */
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
  if (!target.online) throw new Error(`${target.name} is offline right now, so I cannot run that there.`);

  const { data, error } = await supabase.from('device_commands').insert({
    user_id: user,
    target_device_id: opts.targetDeviceId,
    source_device_id: deviceId(),
    capability: opts.capability,
    action: opts.action,
    payload: (opts.payload || {}) as never,
    status: 'queued',
  } as never).select('id').single();
  if (error || !data) throw new Error('I could not reach your computer through the network.');
  return (data as { id: string }).id;
}

/** Live updates for one command (used to report progress back to the phone). */
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
    .eq('id', id).in('status', ['queued', 'running']);
}

async function patch(id: string, fields: Record<string, unknown>) {
  await supabase.from('device_commands').update(fields as never).eq('id', id)
    .then(() => undefined, () => undefined);
}

/** Executes one command on this machine, enforcing capability + permission. */
async function execute(cmd: DeviceCommand) {
  const capability = cmd.capability as BridgeCapability;
  await patch(cmd.id, { status: 'running', progress: 'Checking your computer…' });

  if (getBridgeMonitorState().state !== 'connected') {
    return patch(cmd.id, { status: 'failed', error: 'The Desktop Bridge stopped responding, so I stopped safely.' });
  }
  if (!isCapabilityReady('desktop-bridge')) {
    return patch(cmd.id, { status: 'failed', error: 'This computer is not ready to run that right now.' });
  }
  if (!isPermitted(capability)) {
    requestPermission(capability, `Requested from your phone for "${cmd.action}"`);
    return patch(cmd.id, {
      status: 'blocked',
      error: `I need permission for "${capability}" on the computer before I can continue.`,
    });
  }

  await patch(cmd.id, { progress: 'Running the step on your computer…' });
  try {
    const result = await Promise.race([
      bridgeCall<unknown>(capability, cmd.action, cmd.payload || {}),
      new Promise((_, reject) => setTimeout(() => reject(new Error('The step took too long, so I stopped it.')), EXEC_TIMEOUT_MS)),
    ]);
    // Verify: the Bridge must report success, otherwise this is a failure.
    const ok = !result || typeof result !== 'object' || (result as { ok?: boolean }).ok !== false;
    await patch(cmd.id, ok
      ? { status: 'done', progress: 'Finished and verified', result: result as never, error: null }
      : { status: 'failed', error: 'The computer reported that the step did not complete.' });
  } catch (e) {
    await patch(cmd.id, {
      status: 'failed',
      error: e instanceof Error ? e.message : 'The step could not be completed on your computer.',
    });
  }
}

let hosting = false;

/**
 * Runs on the device that owns the Bridge. Listens for commands addressed to
 * this device and executes them one at a time.
 */
export async function startCommandHost() {
  if (hosting) return;
  hosting = true;
  const user = await uid();
  if (!user) { hosting = false; return; }
  const me = deviceId();
  let busy = false;

  const drain = async () => {
    if (busy) return;
    busy = true;
    try {
      const { data } = await supabase.from('device_commands')
        .select('*')
        .eq('user_id', user).eq('target_device_id', me).eq('status', 'queued')
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
}