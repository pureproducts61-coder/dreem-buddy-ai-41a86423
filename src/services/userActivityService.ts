// User activity tracker — used to log projects + send messages to admin
// Falls back gracefully when the database is unavailable.
import { supabase } from '@/integrations/supabase/client';

// Cast to any because new tables aren't in generated types yet.
const db = supabase as unknown as {
  from: (t: string) => any;
  rpc: (n: string, args?: any) => any;
};

export interface AdminMessage {
  id: string;
  user_id: string;
  user_email: string | null;
  category: string;
  subject: string;
  message: string;
  status: 'unread' | 'read' | 'handled';
  admin_reply: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProjectRow {
  id: string;
  user_id: string;
  user_email: string | null;
  name: string;
  description: string | null;
  type: string;
  status: string;
  created_at: string;
  updated_at: string;
  blocked: boolean;
}

export interface AdminStats {
  total_users: number;
  active_24h: number;
  active_now: number;
  blocked_users: number;
  total_projects: number;
  projects_24h: number;
  unread_messages: number;
  unread_notifications: number;
}

export interface AINotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

/* ===== USER → ADMIN MESSAGE ===== */
export async function sendMessageToAdmin(
  userId: string,
  userEmail: string | null,
  subject: string,
  message: string,
  category: string = 'feedback',
): Promise<void> {
  const { error } = await db.from('admin_messages').insert({
    user_id: userId, user_email: userEmail, subject, message, category,
  });
  if (error) throw error;
}

export async function getMyMessages(): Promise<AdminMessage[]> {
  const { data, error } = await db.from('admin_messages').select('*').order('created_at', { ascending: false });
  if (error) return [];
  return (data || []) as AdminMessage[];
}

/* ===== PROJECT TRACKING ===== */
export async function logUserProject(userId: string, name: string, description?: string, type: string = 'web'): Promise<void> {
  try {
    await db.from('user_projects').insert({ user_id: userId, name, description, type });
  } catch { /* silent */ }
}

export async function touchUserActive(userId: string): Promise<void> {
  try {
    await db.from('user_profiles').update({ last_active: new Date().toISOString() }).eq('user_id', userId);
  } catch { /* silent */ }
}

/* ===== ADMIN: STATS / MONITORING ===== */
export async function getAdminStats(): Promise<AdminStats | null> {
  const { data, error } = await db.rpc('admin_dashboard_stats');
  if (error) return null;
  return data as AdminStats;
}

export async function getAllMessages(): Promise<AdminMessage[]> {
  const { data, error } = await db.rpc('admin_list_messages');
  if (error) return [];
  return (data || []) as AdminMessage[];
}

export async function markMessageHandled(id: string, reply?: string): Promise<void> {
  await db.from('admin_messages').update({
    status: 'handled',
    admin_reply: reply || null,
  }).eq('id', id);
}

export async function getAllProjects(): Promise<UserProjectRow[]> {
  const { data, error } = await db.rpc('admin_list_user_projects');
  if (error) return [];
  return (data || []) as UserProjectRow[];
}

export async function blockUser(targetUserId: string, reason?: string): Promise<void> {
  const { error } = await db.rpc('admin_block_user', { target_user_id: targetUserId, block_reason: reason || null });
  if (error) throw error;
}

export async function unblockUser(targetUserId: string): Promise<void> {
  const { error } = await db.rpc('admin_unblock_user', { target_user_id: targetUserId });
  if (error) throw error;
}

export async function isBlocked(userId: string): Promise<boolean> {
  const { data } = await db.from('user_blocks').select('id').eq('user_id', userId).maybeSingle();
  return !!data;
}

/* ===== AI NOTIFICATIONS ===== */
export async function getNotifications(): Promise<AINotification[]> {
  const { data, error } = await db.from('ai_notifications').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) return [];
  return (data || []) as AINotification[];
}

export async function createNotification(title: string, body: string, type: string = 'info', metadata: Record<string, unknown> = {}): Promise<void> {
  await db.from('ai_notifications').insert({ title, body, type, metadata });
}

export async function markNotificationRead(id: string): Promise<void> {
  await db.from('ai_notifications').update({ read: true }).eq('id', id);
}
