// GitHub Service - calls edge function for GitHub operations
import { supabase } from '@/integrations/supabase/client';
import { getSecretValue } from './systemSettingsService';
import { getUserSecretValue } from './userSecretsService';

const GITHUB_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github`;

/**
 * The GitHub token is never kept in the browser. It is read on demand from the
 * per-user secrets vault, falling back to the admin-managed server settings.
 */
async function getGitHubToken(): Promise<string> {
  try {
    const own = await getUserSecretValue('githubToken');
    if (own) return own;
  } catch { /* fall through */ }
  try {
    return await getSecretValue('githubToken');
  } catch {
    return '';
  }
}

async function callGitHub(action: string, params: Record<string, unknown> = {}) {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error('GitHub token not configured. Add it in Settings → API Keys.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('You must be signed in to use GitHub features.');

  const resp = await fetch(GITHUB_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ action, token, ...params }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || `GitHub error ${resp.status}`);
  }
  return data;
}

/** Minimal shapes of the GitHub Actions lifecycle data we rely on. */
export interface WorkflowRun {
  id: number;
  name?: string;
  head_sha?: string;
  status: 'queued' | 'in_progress' | 'completed' | string;
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | null;
  html_url: string;
  created_at: string;
  updated_at?: string;
}

export interface WorkflowJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string | null;
  steps?: Array<{ name: string; status: string; conclusion: string | null }>;
}

export interface WorkflowArtifact {
  id: number;
  name: string;
  size_in_bytes: number;
  expired: boolean;
  archive_download_url: string;
}

export const githubService = {
  async getUser() {
    return callGitHub('get_user');
  },

  async listRepos() {
    return callGitHub('list_repos');
  },

  async createRepo(name: string, description?: string, isPrivate = true) {
    return callGitHub('create_repo', { name, description, isPrivate });
  },

  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message?: string,
  ) {
    return callGitHub('create_or_update_file', { owner, repo, path, content, message });
  },

  async pushProject(
    owner: string,
    repo: string,
    files: Array<{ path: string; content: string }>,
  ) {
    return callGitHub('push_project', { owner, repo, files });
  },

  async getRepoContents(owner: string, repo: string, path = '') {
    return callGitHub('get_repo_contents', { owner, repo, path });
  },

  async deleteRepo(owner: string, repo: string) {
    return callGitHub('delete_repo', { owner, repo });
  },

  /* --------------- GitHub Actions lifecycle (read-only truth) --------------- */

  async dispatchWorkflow(
    owner: string,
    repo: string,
    workflowId: string,
    ref = 'main',
    inputs: Record<string, string> = {},
  ): Promise<{ success: boolean }> {
    return callGitHub('dispatch_workflow', { owner, repo, workflowId, ref, inputs });
  },

  async listWorkflowRuns(
    owner: string,
    repo: string,
    opts: { branch?: string; perPage?: number } = {},
  ): Promise<{ workflow_runs: WorkflowRun[] }> {
    return callGitHub('list_workflow_runs', { owner, repo, branch: opts.branch, perPage: opts.perPage ?? 10 });
  },

  async getWorkflowRun(owner: string, repo: string, runId: number): Promise<WorkflowRun> {
    return callGitHub('get_workflow_run', { owner, repo, runId });
  },

  async listRunJobs(owner: string, repo: string, runId: number): Promise<{ jobs: WorkflowJob[] }> {
    return callGitHub('list_run_jobs', { owner, repo, runId });
  },

  async listRunArtifacts(owner: string, repo: string, runId: number): Promise<{ artifacts: WorkflowArtifact[] }> {
    return callGitHub('list_run_artifacts', { owner, repo, runId });
  },

  async hasToken(): Promise<boolean> {
    return !!(await getGitHubToken());
  },
};
