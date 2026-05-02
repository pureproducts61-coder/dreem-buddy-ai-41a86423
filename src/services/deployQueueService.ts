// Lightweight client-side deploy queue.
// Tracks "Deploy to Vercel" actions per project so the UI can show
// progress, history, and results without needing a backend job runner.

export type DeployStatus = 'queued' | 'opening' | 'building' | 'ready' | 'error';

export interface DeployJob {
  id: string;
  sessionId: string;
  projectName: string;
  repo: string; // owner/repo
  status: DeployStatus;
  url?: string;
  message?: string;
  startedAt: number;
  updatedAt: number;
}

const KEY = 'tivo-deploy-queue';
const MAX = 25;

type Listener = (jobs: DeployJob[]) => void;
const listeners = new Set<Listener>();

function read(): DeployJob[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function write(jobs: DeployJob[]) {
  localStorage.setItem(KEY, JSON.stringify(jobs.slice(0, MAX)));
  listeners.forEach(l => l(jobs));
}

export function getDeployJobs(): DeployJob[] { return read(); }

export function getJobsForSession(sessionId: string): DeployJob[] {
  return read().filter(j => j.sessionId === sessionId);
}

export function subscribeDeployJobs(listener: Listener): () => void {
  listeners.add(listener);
  listener(read());
  return () => { listeners.delete(listener); };
}

export function enqueueDeploy(input: { sessionId: string; projectName: string; repo: string }): DeployJob {
  const job: DeployJob = {
    id: crypto.randomUUID(),
    sessionId: input.sessionId,
    projectName: input.projectName,
    repo: input.repo,
    status: 'queued',
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };
  const jobs = [job, ...read()];
  write(jobs);
  return job;
}

export function updateDeploy(id: string, patch: Partial<DeployJob>): void {
  const jobs = read().map(j => j.id === id ? { ...j, ...patch, updatedAt: Date.now() } : j);
  write(jobs);
}

export function clearDeployHistory(sessionId?: string): void {
  const jobs = sessionId ? read().filter(j => j.sessionId !== sessionId) : [];
  write(jobs);
}
