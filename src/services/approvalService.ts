import { supabase } from '@/integrations/supabase/client';
import { createNotification, sendMessageToAdmin } from './userActivityService';

const db = supabase as unknown as { from: (t: string) => any };

export interface AutomationApproval {
  id: string;
  user_id: string;
  user_email: string | null;
  action_type: string;
  title: string;
  details: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
  decided_at: string | null;
}

export async function requestApproval(input: {
  userId: string;
  userEmail: string | null;
  actionType: string;
  title: string;
  details?: Record<string, unknown>;
}): Promise<AutomationApproval | null> {
  const { data, error } = await db.from('automation_approvals').insert({
    user_id: input.userId,
    user_email: input.userEmail,
    action_type: input.actionType,
    title: input.title,
    details: input.details || {},
  }).select().single();
  if (error) return null;

  // Mirror to admin inbox + notification feed so admin sees it everywhere
  try {
    await sendMessageToAdmin(
      input.userId,
      input.userEmail,
      `🔐 Approval needed: ${input.title}`,
      `Action type: **${input.actionType}**\n\nDetails:\n\`\`\`json\n${JSON.stringify(input.details || {}, null, 2)}\n\`\`\``,
      'approval',
    );
  } catch { /* ignore */ }
  try {
    await createNotification(`Approval requested: ${input.title}`, input.actionType, 'approval', { approval_id: data.id });
  } catch { /* ignore — only admins can insert notifications */ }

  return data as AutomationApproval;
}

export async function decideApproval(id: string, decision: 'approved' | 'rejected', note?: string): Promise<void> {
  const { error } = await db.from('automation_approvals').update({
    status: decision,
    admin_note: note || null,
    decided_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw error;
}

export async function listApprovals(opts: { mine?: boolean } = {}): Promise<AutomationApproval[]> {
  let q = db.from('automation_approvals').select('*').order('created_at', { ascending: false });
  if (opts.mine) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) q = q.eq('user_id', user.id);
  }
  const { data, error } = await q;
  if (error) return [];
  return (data || []) as AutomationApproval[];
}

/**
 * Wait (poll) for an approval to be decided. Resolves with final status.
 * Times out after `timeoutMs` (default 5 minutes) returning current status.
 */
export async function waitForDecision(approvalId: string, timeoutMs = 300_000): Promise<'approved' | 'rejected' | 'pending'> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await db.from('automation_approvals').select('status').eq('id', approvalId).maybeSingle();
    const status = data?.status as 'pending' | 'approved' | 'rejected' | undefined;
    if (status === 'approved' || status === 'rejected') return status;
    await new Promise(r => setTimeout(r, 4000));
  }
  return 'pending';
}
