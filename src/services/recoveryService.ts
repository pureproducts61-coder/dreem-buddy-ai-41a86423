import { supabase } from '@/integrations/supabase/client';

const db = supabase as unknown as { from: (t: string) => any; rpc: (n: string, args?: any) => any };

export async function logRecoveryEvent(event: string, detail: Record<string, unknown> = {}) {
  try {
    await db.rpc('log_system_recovery_event', { event, detail });
  } catch {
    // Recovery logging must never break the user flow.
  }
}

export async function notifyAdminOfIssue(subject: string, message: string, category = 'recovery') {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await db.from('admin_messages').insert({
      user_id: user.id,
      user_email: user.email || null,
      subject,
      message,
      category,
    });
  } catch {
    // Best-effort only.
  }
}