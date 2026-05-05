import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, AlertCircle, ExternalLink, GitBranch, Trash2, ChevronDown, ChevronUp, RotateCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDeployJobs } from '@/hooks/useDeployJobs';
import { clearDeployHistory, updateDeploy, appendDeployLog, type DeployStatus, type DeployJob } from '@/services/deployQueueService';

interface Props { sessionId: string }

const tone: Record<DeployStatus, string> = {
  queued: 'border-muted-foreground/30 text-muted-foreground',
  opening: 'border-primary/30 text-primary',
  building: 'border-orange-500/30 text-orange-500',
  ready: 'border-emerald-500/30 text-emerald-500',
  error: 'border-destructive/30 text-destructive',
};

export function DeployStatusList({ sessionId }: Props) {
  const jobs = useDeployJobs(sessionId);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Heartbeat + retry/backoff polling for in-flight jobs.
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      jobs.forEach(j => {
        if (j.status === 'ready' || j.status === 'error') return;
        const age = now - j.updatedAt;
        if (j.status === 'opening' && age > 8000) {
          updateDeploy(j.id, { status: 'building', message: 'Vercel is building your project…' });
        }
        if (j.status === 'building') {
          const candidate = `https://${j.repo.split('/')[1]}.vercel.app`;
          const attempts = (j.attempts || 0) + 1;
          // Exponential backoff: trigger probe roughly every 5*1.4^n seconds
          const expected = Math.min(40_000, 5000 * Math.pow(1.4, attempts - 1));
          if (age < expected) return;
          updateDeploy(j.id, { attempts, message: `Probing ${candidate} (attempt ${attempts}/10)…` });
          fetch(candidate, { method: 'HEAD', mode: 'no-cors' })
            .then(() => {
              if (attempts >= 3) {
                updateDeploy(j.id, { status: 'ready', message: 'Site reachable — build finished.', url: candidate });
              } else {
                appendDeployLog(j.id, `attempt ${attempts}: opaque response (still verifying)`);
              }
            })
            .catch(() => {
              if (attempts >= 10) {
                updateDeploy(j.id, { status: 'error', message: 'Polling timed out — open Vercel dashboard for full build logs.', url: `https://vercel.com/dashboard` });
              } else {
                appendDeployLog(j.id, `attempt ${attempts}: not reachable yet, retrying with backoff…`);
              }
            });
        }
      });
    }, 4000);
    return () => clearInterval(t);
  }, [jobs]);

  if (jobs.length === 0) return null;

  const retry = (j: DeployJob) => {
    updateDeploy(j.id, { status: 'building', attempts: 0, message: 'Retrying probe…' });
  };
  const toggle = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  return (
    <div className="space-y-2 mt-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Deploy queue</p>
        <button onClick={() => clearDeployHistory(sessionId)} className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1">
          <Trash2 className="h-2.5 w-2.5" />Clear
        </button>
      </div>
      {jobs.map(j => {
        const Icon = j.status === 'ready' ? CheckCircle2 : j.status === 'error' ? AlertCircle : Loader2;
        const spin = j.status !== 'ready' && j.status !== 'error';
        const isOpen = expanded.has(j.id);
        return (
          <div key={j.id} className="rounded-lg border border-border/40 bg-card/60 text-xs overflow-hidden">
            <div className="flex items-center gap-2 p-2">
              <Icon className={`h-3.5 w-3.5 ${spin ? 'animate-spin' : ''}`} />
              <button onClick={() => toggle(j.id)} className="flex-1 min-w-0 text-left">
                <p className="font-medium truncate">{j.projectName}</p>
                <p className="text-[10px] text-muted-foreground font-mono truncate">
                  <GitBranch className="h-2.5 w-2.5 inline mr-1" />{j.repo}
                </p>
                {j.message && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{j.message}</p>}
              </button>
              <Badge variant="outline" className={`text-[9px] ${tone[j.status]}`}>{j.status}</Badge>
              {j.status === 'error' && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => retry(j)} title="Retry">
                  <RotateCw className="h-3 w-3" />
                </Button>
              )}
              {j.url && (
                <Button asChild variant="ghost" size="icon" className="h-6 w-6">
                  <a href={j.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a>
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggle(j.id)} title="Toggle logs">
                {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>
            {isOpen && (
              <div className="border-t border-border/30 bg-background/40 px-2 py-1.5 space-y-1">
                <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono uppercase tracking-wider">
                  <span>Build log · attempts {j.attempts || 0}</span>
                  <a className="underline hover:text-primary" href={`https://vercel.com/dashboard`} target="_blank" rel="noopener noreferrer">Open Vercel</a>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-0.5 text-[10px] font-mono text-muted-foreground/90">
                  {(j.logs && j.logs.length > 0) ? j.logs.map((l, i) => (
                    <div key={i} className="truncate">{l}</div>
                  )) : <div className="italic">No logs yet — polling will report each stage.</div>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
