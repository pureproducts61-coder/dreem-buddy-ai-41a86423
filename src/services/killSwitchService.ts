import { supabase } from '@/integrations/supabase/client';

const db = supabase as unknown as { from: (t: string) => any; rpc: (n: string, a?: any) => any };

export interface KillSwitchState {
  kill_switch: boolean;
  reason: string | null;
  updated_at: string;
}

let cached: KillSwitchState = { kill_switch: false, reason: null, updated_at: '' };
const listeners = new Set<(s: KillSwitchState) => void>();

export function getKillSwitch(): KillSwitchState { return cached; }

export async function refreshKillSwitch(): Promise<KillSwitchState> {
  try {
    const { data } = await db.rpc('get_kill_switch_state');
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      cached = { kill_switch: !!row.kill_switch, reason: row.reason ?? null, updated_at: row.updated_at };
      listeners.forEach(l => l(cached));
    }
  } catch { /* ignore */ }
  return cached;
}

export function subscribeKillSwitch(cb: (s: KillSwitchState) => void): () => void {
  listeners.add(cb);
  cb(cached);
  refreshKillSwitch();
  // Realtime is intentionally disabled on system_controls to avoid leaking the
  // admin-only `reason` field to non-admin subscribers. Poll periodically instead.
  const interval = setInterval(() => { refreshKillSwitch(); }, 30000);
  return () => { listeners.delete(cb); clearInterval(interval); };
}

export async function setKillSwitch(on: boolean, reason?: string): Promise<void> {
  const { error } = await db.from('system_controls')
    .update({ kill_switch: on, reason: reason || null, updated_at: new Date().toISOString() })
    .eq('id', 'global');
  if (error) throw error;
  await refreshKillSwitch();
}
