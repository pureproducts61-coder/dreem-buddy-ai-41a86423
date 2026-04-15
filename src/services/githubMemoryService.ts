// GitHub-as-a-DB: tivo-memory.json for AI long-term memory
import { githubService } from './githubService';
import { isDbConnected } from './hybridStorageService';

const MEMORY_FILE = 'tivo-memory.json';
const LOCAL_MEMORY_KEY = 'tivo-ai-memory';

interface MemoryEntry {
  topic: string;
  summary: string;
  timestamp: string;
}

interface TivoMemory {
  version: number;
  lastUpdated: string;
  entries: MemoryEntry[];
  userPreferences: Record<string, string>;
  projectSummaries: Record<string, string>;
}

function getEmptyMemory(): TivoMemory {
  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    entries: [],
    userPreferences: {},
    projectSummaries: {},
  };
}

// Get memory — from GitHub if token available, else localStorage
export async function getMemory(): Promise<TivoMemory> {
  // If DB is connected, we don't need GitHub memory
  if (isDbConnected()) {
    return getLocalMemory();
  }

  if (githubService.hasToken()) {
    try {
      const user = await githubService.getUser();
      const repos = await githubService.listRepos();
      const memoryRepo = repos.find((r: { name: string }) => r.name === '.tivo-memory');

      if (memoryRepo) {
        const contents = await githubService.getRepoContents(user.login, '.tivo-memory', MEMORY_FILE);
        if (contents?.content) {
          const decoded = atob(contents.content.replace(/\\n/g, ''));
          return JSON.parse(decoded);
        }
      }
    } catch (e) {
      console.warn('GitHub memory read failed, using local:', e);
    }
  }

  return getLocalMemory();
}

// Save memory — to GitHub if possible, always to localStorage
export async function saveMemory(memory: TivoMemory): Promise<void> {
  memory.lastUpdated = new Date().toISOString();

  // Always save locally
  saveLocalMemory(memory);

  if (!isDbConnected() && githubService.hasToken()) {
    try {
      const user = await githubService.getUser();
      const repos = await githubService.listRepos();
      let memoryRepo = repos.find((r: { name: string }) => r.name === '.tivo-memory');

      if (!memoryRepo) {
        memoryRepo = await githubService.createRepo('.tivo-memory', 'TIVO AI Memory Store', true);
      }

      await githubService.createOrUpdateFile(
        user.login,
        '.tivo-memory',
        MEMORY_FILE,
        JSON.stringify(memory, null, 2),
        `Update AI memory: ${new Date().toISOString()}`
      );
    } catch (e) {
      console.warn('GitHub memory save failed:', e);
    }
  }
}

// Add a memory entry
export async function addMemoryEntry(topic: string, summary: string): Promise<void> {
  const memory = await getMemory();
  memory.entries.push({ topic, summary, timestamp: new Date().toISOString() });
  // Keep last 50 entries
  if (memory.entries.length > 50) {
    memory.entries = memory.entries.slice(-50);
  }
  await saveMemory(memory);
}

// Save project summary
export async function saveProjectSummary(projectId: string, summary: string): Promise<void> {
  const memory = await getMemory();
  memory.projectSummaries[projectId] = summary;
  await saveMemory(memory);
}

// Get memory context for AI prompt
export async function getMemoryContext(): Promise<string> {
  const memory = await getMemory();
  if (memory.entries.length === 0 && Object.keys(memory.projectSummaries).length === 0) {
    return '';
  }

  const parts: string[] = ['[AI Memory Context]:'];

  if (memory.entries.length > 0) {
    const recent = memory.entries.slice(-5);
    parts.push('Recent conversations:');
    for (const e of recent) {
      parts.push(`- ${e.topic}: ${e.summary}`);
    }
  }

  const projectKeys = Object.keys(memory.projectSummaries);
  if (projectKeys.length > 0) {
    parts.push('Project summaries:');
    for (const key of projectKeys.slice(-5)) {
      parts.push(`- ${key}: ${memory.projectSummaries[key]}`);
    }
  }

  return parts.join('\n');
}

// Local storage fallback
function getLocalMemory(): TivoMemory {
  try {
    const stored = localStorage.getItem(LOCAL_MEMORY_KEY);
    return stored ? JSON.parse(stored) : getEmptyMemory();
  } catch {
    return getEmptyMemory();
  }
}

function saveLocalMemory(memory: TivoMemory): void {
  try {
    localStorage.setItem(LOCAL_MEMORY_KEY, JSON.stringify(memory));
  } catch { /* quota exceeded */ }
}
