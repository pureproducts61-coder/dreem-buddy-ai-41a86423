/**
 * Permission audit trail. Every AI attempt to use a device resource is
 * recorded — what, when, why, which capability and whether it was allowed —
 * so the user can always see exactly what TIVO touched.
 * Works offline (local ring buffer) and syncs to the database when possible.
 */
import { supabase } from '@/integrations/supabase/client';

export interface PermissionAuditEntry {
  capability: string;
  action: string;
  allowed: boolean;
  reason?: string;
  source?: 'ai' | 'user' | 'system';
  at: string;
}

const LOCAL_KEY = 'tivo-os-permission-audit';
const MAX_LOCAL = 200;

const listeners = new Set<() => void>();
export const subscribePermissionAudit = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function localPermissionAudit(): PermissionAuditEntry[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
}

export function recordPermissionUse(entry: Omit<PermissionAuditEntry, 'at'>) {
  const row: PermissionAuditEntry = { source: 'ai', ...entry, at: new Date().toISOString() };
  try {
    const next = [row, ...localPermissionAudit()].slice(0, MAX_LOCAL);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  } catch { /* quota */ }
  listeners.forEach((l) => l());

  // best-effort cloud copy; never blocks or throws
  void supabase.auth.getUser().then(({ data }) => {
    if (!data.user) return;
    return supabase.from('permission_audit').insert({
      user_id: data.user.id,
      capability: row.capability,
      action: row.action,
      allowed: row.allowed,
      reason: row.reason ?? null,
      source: row.source ?? 'ai',
    });
  }).then(() => undefined, () => undefined);
}
