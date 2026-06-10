import { supabase } from '@/integrations/supabase/client';
import { logRecoveryEvent } from './recoveryService';

export async function refreshProjectMemoryFromAssistant(content: string, paths: string[] = []) {
  if (!content.trim()) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;
  const files = paths.length > 0
    ? paths.slice(0, 12).map((path) => ({ path, content }))
    : [{ path: 'assistant-output.md', content }];
  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-project-memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ files, note: 'auto refresh after AI code/UI output' }),
    });
    if (!res.ok) throw new Error(`memory_refresh_${res.status}`);
  } catch (e) {
    await logRecoveryEvent('memory_refresh_failed', { reason: e instanceof Error ? e.message : String(e) });
  }
}