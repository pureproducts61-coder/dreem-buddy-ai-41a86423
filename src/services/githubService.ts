// GitHub Service - calls edge function for GitHub operations

const GITHUB_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/github`;

function getGitHubToken(): string {
  try {
    const stored = localStorage.getItem('dreem-settings');
    if (stored) {
      const settings = JSON.parse(stored);
      return settings.githubToken || '';
    }
  } catch {}
  return '';
}

async function callGitHub(action: string, params: Record<string, unknown> = {}) {
  const token = getGitHubToken();
  if (!token) {
    throw new Error('GitHub token not configured. Add it in Settings → API Keys.');
  }

  const resp = await fetch(GITHUB_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ action, token, ...params }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || `GitHub error ${resp.status}`);
  }
  return data;
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

  hasToken(): boolean {
    return !!getGitHubToken();
  },
};
