import { useMemo, useState } from 'react';
import {
  Download, Globe, Monitor, Smartphone, Loader2, Package, Archive,
  CircleDot, CheckCircle2, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { BuildTarget } from '@/services/projectExportService';
import { githubService } from '@/services/githubService';
import { useToast } from '@/hooks/use-toast';
import {
  runBuildPipeline, type PipelineStepState, type PipelineResult,
} from '@/services/buildPipelineService';

type FullTarget = BuildTarget | 'zip';

interface BuildDeliveryDialogProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  projectId: string;
  files: Array<{ path: string; content: string }>;
}

const targets: Array<{ key: FullTarget; icon: typeof Globe; label: string; desc: string }> = [
  { key: 'zip', icon: Archive, label: 'ZIP Archive', desc: 'Local download — no GitHub needed' },
  { key: 'web', icon: Globe, label: 'Web App', desc: 'Push to GitHub → Deploy to Vercel' },
  { key: 'exe', icon: Monitor, label: 'Windows (.exe)', desc: 'Electron + GitHub Actions' },
  { key: 'apk', icon: Smartphone, label: 'Android (.apk)', desc: 'Capacitor + GitHub Actions' },
];

function StepRow({ step }: { step: PipelineStepState }) {
  const Icon =
    step.status === 'done' ? CheckCircle2 :
    step.status === 'error' ? AlertTriangle :
    step.status === 'active' ? Loader2 : CircleDot;
  const color =
    step.status === 'done' ? 'text-emerald-500' :
    step.status === 'error' ? 'text-destructive' :
    step.status === 'active' ? 'text-primary' : 'text-muted-foreground/60';
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', color, step.status === 'active' && 'animate-spin')} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-medium', step.status === 'pending' && 'text-muted-foreground')}>
          {step.label}
        </p>
        {step.detail && (
          <p className="text-[11px] text-muted-foreground mt-0.5 break-words">{step.detail}</p>
        )}
      </div>
    </div>
  );
}

export function BuildDeliveryDialog({ open, onClose, projectName, projectId, files }: BuildDeliveryDialogProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<FullTarget>('zip');
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<PipelineStepState[]>([]);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const hasGithub = githubService.hasToken();

  const needsGithub = selected !== 'zip';
  const canRun = useMemo(() => files.length > 0 && (!needsGithub || hasGithub), [files.length, needsGithub, hasGithub]);

  async function handleRun() {
    if (!canRun) {
      if (needsGithub && !hasGithub) {
        toast({
          title: 'GitHub Token প্রয়োজন',
          description: 'Settings → Tools & Integrations → GitHub Token যোগ করুন।',
          variant: 'destructive',
        });
      } else if (files.length === 0) {
        toast({
          title: 'প্রজেক্ট ফাইল পাওয়া যায়নি',
          description: 'এই সেশনে কোনো বিল্ড ফাইল সেভ হয়নি। আগে Chat / Build মোডে কোড জেনারেট করুন।',
          variant: 'destructive',
        });
      }
      return;
    }
    setRunning(true);
    setResult(null);
    setSteps([]);
    try {
      const res = await runBuildPipeline({
        projectName,
        projectId,
        files,
        buildTarget: selected as BuildTarget,
        onUpdate: (s) => setSteps(s),
      });
      setResult(res);
      if (res.ok) {
        toast({ title: '✅ Build pipeline সফল', description: res.runUrl || 'Done' });
      } else {
        toast({ title: 'Pipeline থামল', description: res.error || 'failed', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  }

  function handleClose() {
    if (running) return;
    setSteps([]);
    setResult(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Project Delivery Pipeline
          </DialogTitle>
          <DialogDescription>
            Architect → Coder → Reviewer chain. {files.length} file(s) ready.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {targets.map((t) => {
            const Icon = t.icon;
            const disabled = running;
            return (
              <button
                key={t.key}
                onClick={() => !disabled && setSelected(t.key)}
                disabled={disabled}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl border p-3 transition-all text-left',
                  selected === t.key
                    ? 'border-primary bg-primary/5'
                    : 'border-border/40 hover:border-border',
                  disabled && 'opacity-60 cursor-not-allowed',
                )}
              >
                <div className={cn(
                  'h-9 w-9 rounded-xl flex items-center justify-center',
                  selected === t.key ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground',
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{t.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {steps.length > 0 && (
          <div className="rounded-xl border border-border/40 bg-secondary/30 p-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
              Pipeline Status
            </p>
            <div className="divide-y divide-border/30">
              {steps.map((s) => <StepRow key={s.id} step={s} />)}
            </div>
            {result?.runUrl && (
              <a
                href={result.runUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View GitHub Actions run
              </a>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleClose} disabled={running} className="flex-1">
            Close
          </Button>
          <Button onClick={handleRun} disabled={running || !canRun} className="flex-1 gap-2">
            {running
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Running…</>
              : <><Download className="h-4 w-4" /> Run Pipeline</>}
          </Button>
        </div>

        {needsGithub && !hasGithub && (
          <p className="text-[11px] text-amber-500 text-center">
            GitHub token required for {selected.toUpperCase()} — add it in Settings.
          </p>
        )}
        {files.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center">
            💡 No saved files for this session. Generate code in Chat / Build mode first.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
