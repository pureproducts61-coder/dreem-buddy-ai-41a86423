import { supabase } from '@/integrations/supabase/client';

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TaskKind = 'chat' | 'web_search' | 'code_gen' | 'build' | 'analyze';

export interface AiTaskRow {
  id: string;
  user_id: string;
  session_id: string | null;
  project_id: string | null;
  kind: TaskKind | string;
  status: TaskStatus;
  step: string | null;
  progress: number;
  input: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error: string | null;
  credits_used: number | null;
  execution_time_ms: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/* ------------------------------------------------------------------ */
/* localStorage cache — makes TaskProgressCard render instantly on     */
/* mobile / offline reloads without waiting for Supabase Realtime.     */
/* Keeps only the 10 most-recent tasks.                                */
/* ------------------------------------------------------------------ */

const CACHE_KEY = 'tivo-ai-task-cache-v1';
const CACHE_MAX = 10;

function readCache(): Record<string, AiTaskRow> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') as Record<string, AiTaskRow>;
  } catch {
    return {};
  }
}

function writeCache(map: Record<string, AiTaskRow>) {
  const entries = Object.entries(map);
  if (entries.length > CACHE_MAX) {
    entries.sort((a, b) => (b[1].updated_at || '').localeCompare(a[1].updated_at || ''));
    map = Object.fromEntries(entries.slice(0, CACHE_MAX));
  }
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch { /* quota */ }
}

export function cacheTask(row: AiTaskRow) {
  if (!row?.id) return;
  const map = readCache();
  map[row.id] = { ...(map[row.id] || {}), ...row };
  writeCache(map);
}

export function getCachedTask(id: string): AiTaskRow | null {
  return readCache()[id] || null;
}

export function getRecentCachedTasks(limit = 5): AiTaskRow[] {
  return Object.values(readCache())
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
    .slice(0, limit);
}

export async function createAiTask(input: {
  kind: TaskKind | string;
  sessionId?: string | null;
  projectId?: string | null;
  step?: string;
  payload?: Record<string, unknown>;
}): Promise<AiTaskRow | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('ai_tasks')
    .insert({
      user_id: user.id,
      session_id: input.sessionId || null,
      project_id: input.projectId || null,
      kind: input.kind,
      status: 'queued',
      step: input.step || 'Queued',
      progress: 0,
      input: (input.payload || {}) as never,
    })
    .select('*')
    .single();
  if (error) {
    console.warn('createAiTask failed:', error.message);
    return null;
  }
  const row = data as unknown as AiTaskRow;
  cacheTask(row);
  return row;
}

export async function updateAiTask(id: string, patch: Partial<AiTaskRow>): Promise<void> {
  const { error } = await supabase.from('ai_tasks').update(patch as never).eq('id', id);
  if (error) console.warn('updateAiTask failed:', error.message);
  const existing = getCachedTask(id);
  if (existing) cacheTask({ ...existing, ...(patch as AiTaskRow), updated_at: new Date().toISOString() });
}

export function subscribeAiTask(
  taskId: string,
  onUpdate: (row: AiTaskRow) => void,
): () => void {
  const channel = supabase
    .channel(`ai-task-${taskId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'ai_tasks', filter: `id=eq.${taskId}` },
      (payload) => {
        const row = (payload.new || payload.old) as AiTaskRow;
        if (row) { cacheTask(row); onUpdate(row); }
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}