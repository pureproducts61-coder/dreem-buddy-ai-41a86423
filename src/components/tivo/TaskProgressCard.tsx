import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Search, Cpu, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { subscribeAiTask, type AiTaskRow } from '@/services/aiTaskService';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface TaskProgressCardProps {
  taskId: string;
  compact?: boolean;
  onComplete?: (row: AiTaskRow) => void;
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

export function TaskProgressCard({ taskId, compact, onComplete }: TaskProgressCardProps) {
  const [row, setRow] = useState<AiTaskRow | null>(null);
  const [typedStep, setTypedStep] = useState('');

  useEffect(() => {
    let alive = true;
    supabase.from('ai_tasks').select('*').eq('id', taskId).maybeSingle()
      .then(({ data }) => { if (alive && data) setRow(data as unknown as AiTaskRow); });
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
    let i = 0;
    setTypedStep('');
    const t = setInterval(() => {
      i++;
      setTypedStep(target.slice(0, i));
      if (i >= target.length) clearInterval(t);
    }, 18);
    return () => clearInterval(t);
  }, [row?.step]);

  if (!row) return null;
  const Icon = iconFor(row.step);
  const done = row.status === 'completed';
  const failed = row.status === 'failed' || row.status === 'cancelled';
  const StatusIcon = done ? CheckCircle2 : failed ? XCircle : Loader2;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className={cn(
          'rounded-2xl border border-border/40 bg-card/70 backdrop-blur-md',
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
                {!done && !failed && (
                  <motion.span
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="ml-1 text-primary"
                  >▍</motion.span>
                )}
              </p>
              <StatusIcon className={cn('h-3.5 w-3.5 shrink-0', !done && !failed && 'animate-spin text-primary')} />
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-secondary/60 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${done ? 100 : Math.max(row.progress || 0, 5)}%` }}
                transition={{ duration: 0.4 }}
                className={cn(
                  'h-full',
                  done ? 'bg-emerald-500' : failed ? 'bg-destructive' : 'bg-primary',
                )}
              />
            </div>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
            {done ? '100%' : failed ? '—' : `${row.progress || 0}%`}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}