import { supabase } from '@/integrations/supabase/client';

const db = supabase as unknown as { from: (t: string) => any };

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
    const { data } = await db.from('system_controls').select('*').eq('id', 'global').maybeSingle();
    if (data) {
      cached = { kill_switch: !!data.kill_switch, reason: data.reason, updated_at: data.updated_at };
      listeners.forEach(l => l(cached));
    }
  } catch { /* ignore */ }
  return cached;
}

export function subscribeKillSwitch(cb: (s: KillSwitchState) => void): () => void {
  listeners.add(cb);
  cb(cached);
  refreshKillSwitch();
  const channel = supabase
    .channel('system-controls')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'system_controls' }, () => { refreshKillSwitch(); })
    .subscribe();
  return () => { listeners.delete(cb); supabase.removeChannel(channel); };
}

export async function setKillSwitch(on: boolean, reason?: string): Promise<void> {
  const { error } = await db.from('system_controls')
    .update({ kill_switch: on, reason: reason || null, updated_at: new Date().toISOString() })
    .eq('id', 'global');
  if (error) throw error;
  await refreshKillSwitch();
}
