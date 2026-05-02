import { useEffect } from 'react';
import { CheckCircle2, Loader2, AlertCircle, ExternalLink, GitBranch, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDeployJobs } from '@/hooks/useDeployJobs';
import { clearDeployHistory, updateDeploy, type DeployStatus } from '@/services/deployQueueService';

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

  // Auto-progress queued → opening (visual heartbeat) so UI doesn't look frozen
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      jobs.forEach(j => {
        if (j.status === 'opening' && now - j.updatedAt > 8000) {
          updateDeploy(j.id, { status: 'building', message: 'Vercel is building your project…' });
        }
      });
    }, 2500);
    return () => clearInterval(t);
  }, [jobs]);

  if (jobs.length === 0) return null;

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
        return (
          <div key={j.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/40 bg-card/60 text-xs">
            <Icon className={`h-3.5 w-3.5 ${spin ? 'animate-spin' : ''}`} />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{j.projectName}</p>
              <p className="text-[10px] text-muted-foreground font-mono truncate">
                <GitBranch className="h-2.5 w-2.5 inline mr-1" />{j.repo}
              </p>
              {j.message && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{j.message}</p>}
            </div>
            <Badge variant="outline" className={`text-[9px] ${tone[j.status]}`}>{j.status}</Badge>
            {j.url && (
              <Button asChild variant="ghost" size="icon" className="h-6 w-6">
                <a href={j.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /></a>
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
