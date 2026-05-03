import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Loader2, ChevronDown, ChevronRight,
  ThumbsUp, ThumbsDown, Copy, Check, Clock, Coins, Sparkles,
  FileCode, Search, GitBranch, Rocket, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolEvent } from '@/services/aiChatService';

export interface TaskCardProps {
  events: ToolEvent[];
  isActive: boolean;
  finalSummary?: string;
  durationMs?: number;
  creditsUsed?: number;
  onCopy?: () => void;
  onLike?: () => void;
  onDislike?: () => void;
}

interface Step { id: string; label: string; status: 'active' | 'done' | 'error'; tool: string; }

function iconFor(tool: string) {
  if (tool.includes('write') || tool.includes('file')) return FileCode;
  if (tool.includes('repo') || tool.includes('push') || tool.includes('branch')) return GitBranch;
  if (tool.includes('deploy') || tool.includes('vercel')) return Rocket;
  if (tool.includes('read') || tool.includes('list') || tool.includes('search')) return Search;
  return Sparkles;
}

function eventsToSteps(events: ToolEvent[]): Step[] {
  const map = new Map<string, Step>();
  events.forEach((e, i) => {
    if (e.type === 'thinking') return;
    const key = `${e.tool}:${(e.args?.path || e.args?.name || e.args?.repo || i) as string}`;
    const existing = map.get(key);
    const label = (e.args?.path || e.args?.name || e.args?.repo || e.tool) as string;
    if (e.type === 'tool_start') {
      map.set(key, { id: key, label: String(label), status: 'active', tool: e.tool });
    } else if (e.type === 'tool_result') {
      const status: Step['status'] = e.result?.error ? 'error' : 'done';
      map.set(key, { id: key, label: String(label), status, tool: e.tool });
    }
    if (existing && map.get(key)!.status === 'active' && existing.status === 'done') {
      map.set(key, existing);
    }
  });
  return Array.from(map.values());
}

export function TaskExecutionCard({
  events, isActive, finalSummary, durationMs, creditsUsed,
  onCopy, onLike, onDislike,
}: TaskCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);

  const steps = useMemo(() => eventsToSteps(events), [events]);
  const currentStep = steps.find(s => s.status === 'active');
  const doneCount = steps.filter(s => s.status === 'done').length;

  if (steps.length === 0 && !finalSummary) return null;

  const handleCopy = async () => {
    onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/40 bg-card/70 backdrop-blur-md overflow-hidden shadow-sm"
    >
      {/* Streaming header */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2.5">
        {isActive ? (
          <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            {isActive ? 'Working' : 'Completed'} · {doneCount}/{steps.length}
          </p>
          <p className="text-sm font-medium truncate">
            {currentStep ? currentStep.label : steps[steps.length - 1]?.label || 'Planning…'}
          </p>
        </div>
      </div>

      {/* Step list */}
      {steps.length > 0 && (
        <ul className="divide-y divide-border/20">
          {steps.slice(0, 8).map(s => {
            const Icon = iconFor(s.tool);
            return (
              <li key={s.id} className="px-4 py-2 flex items-center gap-2.5 text-[13px]">
                {s.status === 'active' ? (
                  <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
                ) : s.status === 'error' ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                )}
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className={cn(
                  'truncate flex-1 font-mono text-[12px]',
                  s.status === 'done' && 'text-muted-foreground line-through decoration-1 decoration-muted-foreground/40',
                )}>
                  {s.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Details toggle */}
      {steps.length > 0 && (
        <button
          onClick={() => setDetailsOpen(o => !o)}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 border-t border-border/30"
        >
          {detailsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Details ({events.length})
        </button>
      )}

      <AnimatePresence>
        {detailsOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border/30 bg-secondary/20 overflow-hidden"
          >
            <div className="px-4 py-3 space-y-1.5 max-h-64 overflow-y-auto">
              {events.map((e, i) => (
                <div key={i} className="text-[11px] font-mono text-muted-foreground flex items-start gap-2">
                  <span className={cn(
                    'shrink-0 px-1.5 rounded text-[9px] uppercase',
                    e.type === 'tool_start' ? 'bg-primary/15 text-primary' :
                    e.type === 'tool_result' && e.result?.error ? 'bg-destructive/15 text-destructive' :
                    'bg-emerald-500/15 text-emerald-500',
                  )}>{e.type === 'thinking' ? 'think' : e.type.replace('tool_', '')}</span>
                  <span className="truncate flex-1">
                    {e.tool || e.thinking?.message || ''} {e.args?.path ? `→ ${e.args.path}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Final summary */}
      {!isActive && finalSummary && (
        <div className="px-4 py-3 border-t border-border/30 bg-secondary/10 text-[12px] text-muted-foreground">
          {finalSummary}
        </div>
      )}

      {/* Footer: feedback + meta */}
      {!isActive && (
        <div className="px-4 py-2 border-t border-border/30 flex items-center gap-2 text-[11px] text-muted-foreground">
          <button
            onClick={() => { setFeedback('like'); onLike?.(); }}
            className={cn('p-1 rounded hover:bg-secondary/60', feedback === 'like' && 'text-primary')}
          ><ThumbsUp className="h-3 w-3" /></button>
          <button
            onClick={() => { setFeedback('dislike'); onDislike?.(); }}
            className={cn('p-1 rounded hover:bg-secondary/60', feedback === 'dislike' && 'text-destructive')}
          ><ThumbsDown className="h-3 w-3" /></button>
          <button onClick={handleCopy} className="p-1 rounded hover:bg-secondary/60">
            {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
          </button>
          <span className="ml-auto inline-flex items-center gap-3">
            {durationMs !== undefined && (
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{(durationMs / 1000).toFixed(1)}s</span>
            )}
            {creditsUsed !== undefined && creditsUsed > 0 && (
              <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3" />{creditsUsed}</span>
            )}
          </span>
        </div>
      )}
    </motion.div>
  );
}