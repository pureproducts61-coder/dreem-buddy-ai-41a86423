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
  return data as unknown as AiTaskRow;
}

export async function updateAiTask(id: string, patch: Partial<AiTaskRow>): Promise<void> {
  const { error } = await supabase.from('ai_tasks').update(patch as never).eq('id', id);
  if (error) console.warn('updateAiTask failed:', error.message);
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
        if (row) onUpdate(row);
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}