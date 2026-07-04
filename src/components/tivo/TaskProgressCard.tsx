import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Search, Cpu, CheckCircle2, XCircle, Sparkles, X, RotateCw } from 'lucide-react';
import { subscribeAiTask, updateAiTask, getCachedTask, cacheTask, type AiTaskRow } from '@/services/aiTaskService';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface TaskProgressCardProps {
  taskId: string;
  compact?: boolean;
  onComplete?: (row: AiTaskRow) => void;
  onRetry?: (row: AiTaskRow) => void;
}

const STEP_ICONS: Record<string, React.ElementType> = {
  Analyzing: Cpu,
  Searching: Search,
  Thinking: Sparkles,
  Building: Cpu,
};

function iconFor(step: string | null): React.ElementType {
  if (!step) return Sparkles;
  const k = step.split(/\s|—|:/)[0];
  return STEP_ICONS[k] || Sparkles;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setReduced(mq.matches);
    handler();
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return reduced;
}

export function TaskProgressCard({ taskId, compact, onComplete, onRetry }: TaskProgressCardProps) {
  // Seed from localStorage so mobile/offline reloads render instantly.
  const [row, setRow] = useState<AiTaskRow | null>(() => getCachedTask(taskId));
  const [typedStep, setTypedStep] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    let alive = true;
    supabase.from('ai_tasks').select('*').eq('id', taskId).maybeSingle()
      .then(({ data }) => {
        if (alive && data) {
          const r = data as unknown as AiTaskRow;
          setRow(r);
          cacheTask(r);
        }
      });
    const unsub = subscribeAiTask(taskId, (r) => {
      if (!alive) return;
      setRow(r);
      if ((r.status === 'completed' || r.status === 'failed') && onComplete) onComplete(r);
    });
    return () => { alive = false; unsub(); };
  }, [taskId, onComplete]);

  // Typewriter effect on the step label
  useEffect(() => {
    const target = row?.step || '';
    if (target === typedStep) return;
    if (reducedMotion) { setTypedStep(target); return; }
    let i = 0;
    setTypedStep('');
    const t = setInterval(() => {
      i++;
      setTypedStep(target.slice(0, i));
      if (i >= target.length) clearInterval(t);
    }, 18);
    return () => clearInterval(t);
  }, [row?.step, reducedMotion]);

  if (!row) return null;
  const Icon = iconFor(row.step);
  const done = row.status === 'completed';
  const failed = row.status === 'failed' || row.status === 'cancelled';
  const active = !done && !failed;
  const StatusIcon = done ? CheckCircle2 : failed ? XCircle : Loader2;

  const handleCancel = async () => {
    if (!active || cancelling) return;
    setCancelling(true);
    try {
      await updateAiTask(taskId, { status: 'cancelled', step: 'Cancelled by user', error: 'cancelled' } as never);
    } finally {
      setCancelling(false);
    }
  };

  const handleRetry = () => {
    if (!failed || !onRetry) return;
    onRetry(row);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (active && (e.key === 'Escape' || (e.key.toLowerCase() === 'c' && (e.metaKey || e.ctrlKey)))) {
      e.preventDefault();
      handleCancel();
    }
    if (failed && onRetry && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      handleRetry();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={`Task ${row.status}: ${row.step || 'working'} ${row.progress || 0}%`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={cn(
          'rounded-2xl border border-border/40 bg-card/70 backdrop-blur-md outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
          compact ? 'px-3 py-2' : 'px-4 py-3',
          done && 'border-emerald-500/30 bg-emerald-500/5',
          failed && 'border-destructive/40 bg-destructive/5',
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'h-8 w-8 rounded-xl flex items-center justify-center shrink-0',
            done ? 'bg-emerald-500/10 text-emerald-500'
              : failed ? 'bg-destructive/10 text-destructive'
              : 'bg-primary/10 text-primary',
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-medium text-foreground truncate">
                {typedStep || (done ? 'Complete' : failed ? (row.error || 'Failed') : 'Working…')}
                {active && !reducedMotion && (
                  <motion.span
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="ml-1 text-primary"
                    aria-hidden="true"
                  >▍</motion.span>
                )}
              </p>
              <StatusIcon className={cn('h-3.5 w-3.5 shrink-0', active && !reducedMotion && 'animate-spin text-primary')} aria-hidden="true" />
            </div>
            <div
              className="mt-1.5 h-1 rounded-full bg-secondary/60 overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={done ? 100 : failed ? 0 : (row.progress || 0)}
            >
              <motion.div
                initial={reducedMotion ? false : { width: 0 }}
                animate={{ width: `${done ? 100 : Math.max(row.progress || 0, 5)}%` }}
                transition={{ duration: reducedMotion ? 0 : 0.4 }}
                className={cn(
                  'h-full',
                  done ? 'bg-emerald-500' : failed ? 'bg-destructive' : 'bg-primary',
                )}
              />
            </div>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums" aria-hidden="true">
            {done ? '100%' : failed ? '—' : `${row.progress || 0}%`}
          </span>
          {active && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              aria-label="Cancel task"
              className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 disabled:opacity-40"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {failed && onRetry && (
            <button
              type="button"
              onClick={handleRetry}
              aria-label="Retry task"
              className="h-7 px-2 rounded-lg flex items-center gap-1 text-[11px] font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <RotateCw className="h-3 w-3" />Retry
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}