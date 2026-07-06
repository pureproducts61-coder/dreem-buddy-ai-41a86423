/**
 * Build Reports Service
 *
 * Persists every build pipeline run to `public.build_reports` so the Admin
 * panel can render detailed bug / security reports and history per build.
 * All calls are best-effort — DB failures never break the build UI.
 */
import { supabase } from '@/integrations/supabase/client';
import type { PipelineStepState } from './buildPipelineService';

// The generated Supabase types don't know about `build_reports` yet, so we
// cast at the edge and keep the app-side surface strongly typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyDb = supabase as any;

export interface BuildReportRow {
  id: string;
  user_id: string;
  project_id: string | null;
  project_name: string;
  build_target: string;
  status: 'running' | 'succeeded' | 'failed';
  steps: PipelineStepState[];
  findings: Array<{ file: string; severity: string; message: string }>;
  run_url: string | null;
  repo_url: string | null;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

export async function createBuildReport(input: {
  projectName: string;
  projectId: string;
  buildTarget: string;
}): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await anyDb
      .from('build_reports')
      .insert({
        user_id: user.id,
        project_id: input.projectId,
        project_name: input.projectName,
        build_target: input.buildTarget,
        status: 'running',
        steps: [],
        findings: [],
      })
      .select('id')
      .single();
    if (error) return null;
    return data?.id ?? null;
  } catch {
    return null;
  }
}

export async function updateBuildReport(id: string, patch: {
  status?: 'running' | 'succeeded' | 'failed';
  steps?: PipelineStepState[];
  findings?: Array<{ file: string; severity: string; message: string }>;
  run_url?: string | null;
  repo_url?: string | null;
  error?: string | null;
  duration_ms?: number | null;
}): Promise<void> {
  try {
    await anyDb.from('build_reports').update(patch).eq('id', id);
  } catch { /* ignore */ }
}

export async function listBuildReports(limit = 50): Promise<BuildReportRow[]> {
  try {
    const { data, error } = await anyDb
      .from('build_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as BuildReportRow[];
  } catch {
    return [];
  }
}

export async function deleteBuildReports(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  try {
    const { error } = await anyDb.from('build_reports').delete().in('id', ids);
    return error ? 0 : ids.length;
  } catch {
    return 0;
  }
}
