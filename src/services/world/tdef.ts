/**
 * TDEF client. Execution happens only server-side (tdef-execute), after the
 * server re-checks Control. Results are returned exactly as reported —
 * 'completed' means the runtime ran, NOT that the goal is verified.
 */
import { supabase } from '@/integrations/supabase/client';

export type ExecStatus =
  | 'started' | 'running' | 'completed' | 'failed' | 'timed_out'
  | 'cancelled' | 'unknown' | 'refused' | 'runtime_unavailable';

export interface ExecutionRecord {
  id?: string;
  request_id?: string;
  runtime_id: string | null;
  status: ExecStatus;
  observations: Array<{ fact: string; value: unknown; observedAt: string; source: string }>;
  error: string | null;
  duration_ms?: number | null;
}

export interface ExecuteOutcome { execution: ExecutionRecord; reused: boolean; reconcile: boolean }

export async function executeInteraction(requestId: string): Promise<ExecuteOutcome> {
  const { data, error } = await supabase.functions.invoke('tdef-execute', { body: { requestId } });
  if (error || !data?.execution) {
    return {
      execution: { runtime_id: null, status: 'unknown', observations: [], error: error?.message ?? 'no response' },
      reused: false,
      reconcile: true,
    };
  }
  return data as ExecuteOutcome;
}
