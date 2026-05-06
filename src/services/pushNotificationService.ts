// Lightweight in-browser notification system.
// Uses the Notification API (works on Chrome desktop + Android PWA without VAPID infra).
// Hooked into Supabase realtime — when admin_messages or ai_notifications get a new row,
// the admin's currently-open client will fire a system notification + in-app sound.
import { supabase } from '@/integrations/supabase/client';

let started = false;
let channel: ReturnType<typeof supabase.channel> | null = null;
const PREF_KEY = 'tivo-push-enabled';

export function isPushEnabledPref(): boolean {
  return localStorage.getItem(PREF_KEY) !== 'false';
}
export function setPushEnabledPref(on: boolean): void {
  localStorage.setItem(PREF_KEY, on ? 'true' : 'false');
  if (!on) stopAdminPushListener();
}

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

function notify(title: string, body: string, tag?: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag,
    });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* ignore */ }
}

export async function startAdminPushListener(): Promise<void> {
  if (started) return;
  if (!isPushEnabledPref()) return;
  started = true;
  await ensureNotificationPermission();

  channel = supabase
    .channel('admin-push-feed')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_messages' }, (payload) => {
      const row = payload.new as { subject?: string; message?: string; user_email?: string };
      notify(`📬 ${row.subject || 'New message'}`, `${row.user_email || 'User'}: ${(row.message || '').slice(0, 120)}`, `msg-${(payload.new as any).id}`);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_notifications' }, (payload) => {
      const row = payload.new as { title?: string; body?: string };
      notify(`🔔 ${row.title || 'TIVO alert'}`, row.body || '', `alert-${(payload.new as any).id}`);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'automation_approvals' }, (payload) => {
      const row = payload.new as { title?: string; action_type?: string };
      notify(`🔐 Approval needed`, `${row.title || row.action_type || ''}`, `approval-${(payload.new as any).id}`);
    })
    .subscribe();
}

export function stopAdminPushListener(): void {
  if (channel) supabase.removeChannel(channel);
  channel = null;
  started = false;
}

/** Lightweight listener for regular users — fires when admin replies to their messages. */
let userChannel: ReturnType<typeof supabase.channel> | null = null;
export async function startUserPushListener(userId: string): Promise<void> {
  if (userChannel || !isPushEnabledPref()) return;
  await ensureNotificationPermission();
  userChannel = supabase.channel(`user-push-${userId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'admin_messages', filter: `user_id=eq.${userId}` }, (payload) => {
      const row = payload.new as { admin_reply?: string; subject?: string };
      if (row.admin_reply) {
        notify('💬 Admin replied', `${row.subject || ''}: ${(row.admin_reply || '').slice(0, 120)}`, `reply-${(payload.new as any).id}`);
      }
    })
    .subscribe();
}
export function stopUserPushListener(): void {
  if (userChannel) supabase.removeChannel(userChannel);
  userChannel = null;
}
