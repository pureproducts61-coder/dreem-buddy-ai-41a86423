import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Search, FileCode, GitBranch, Rocket, CheckCircle2, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import type { ToolEvent } from '@/services/aiChatService';

export interface ThinkingStep {
  id: string;
  icon: 'analyze' | 'plan' | 'code' | 'push' | 'verify' | 'retry' | 'done' | 'error';
  label: string;
  status: 'active' | 'done' | 'error';
  timestamp: Date;
}

const iconMap = {
  analyze: Search,
  plan: Brain,
  code: FileCode,
  push: GitBranch,
  verify: Rocket,
  retry: RefreshCw,
  done: CheckCircle2,
  error: AlertTriangle,
};

const colorMap = {
  analyze: 'text-cyan-400',
  plan: 'text-purple-400',
  code: 'text-blue-400',
  push: 'text-green-400',
  verify: 'text-yellow-400',
  retry: 'text-orange-400',
  done: 'text-green-400',
  error: 'text-red-400',
};

interface ThinkingTrackerProps {
  steps: ThinkingStep[];
  isActive: boolean;
}

export function ThinkingTracker({ steps, isActive }: ThinkingTrackerProps) {
  if (steps.length === 0 && !isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mx-3 mb-2 rounded-xl border border-border/40 bg-secondary/30 backdrop-blur-sm overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-border/20 flex items-center gap-2">
        {isActive && <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />}
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {isActive ? 'AI is working...' : 'Completed'}
        </span>
      </div>
      <div className="px-3 py-2 space-y-1">
        <AnimatePresence>
          {steps.map((step, i) => {
            const Icon = iconMap[step.icon];
            const color = colorMap[step.icon];
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -8, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 py-0.5"
              >
                {step.status === 'active' ? (
                  <Loader2 className={`h-3.5 w-3.5 ${color} animate-spin flex-shrink-0`} />
                ) : step.status === 'error' ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400/70 flex-shrink-0" />
                )}
                <span className={`text-xs font-mono truncate ${step.status === 'done' ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Helper to convert tool events into thinking steps
export function toolEventsToThinkingSteps(events: ToolEvent[]): ThinkingStep[] {
  return events.map((e, i) => {
    const isStart = e.type === 'tool_start';
    const isError = e.type === 'tool_result' && e.result?.error;

    let icon: ThinkingStep['icon'] = 'code';
    let label = e.tool;

    switch (e.tool) {
      case 'list_repo_files':
        icon = 'analyze';
        label = isStart ? '🔍 Analyzing repository structure...' : `✓ Found ${(e.result as any)?.files?.length || 0} files`;
        break;
      case 'read_file_from_github':
        icon = 'analyze';
        label = isStart ? `🔍 Reading ${e.args?.path || 'file'}...` : `✓ Read ${e.result?.path || 'file'}`;
        break;
      case 'create_github_repo':
        icon = 'push';
        label = isStart ? `📦 Creating repository: ${e.args?.name}...` : `✓ Repository created: ${e.result?.url || ''}`;
        break;
      case 'write_file_to_github':
        icon = 'code';
        label = isStart ? `📝 Writing: ${e.args?.path}...` : `✓ Written: ${e.result?.path || e.args?.path}`;
        break;
      case 'push_multiple_files':
        icon = 'push';
        label = isStart ? `🚀 Pushing ${(e.args?.files as any[])?.length || 'multiple'} files...` : `✓ Pushed ${e.result?.files_pushed || 0} files`;
        break;
      case 'delete_github_repo':
        icon = 'error';
        label = isStart ? `🗑️ Deleting repository...` : `✓ Repository deleted`;
        break;
    }

    if (isError) {
      icon = 'error';
      label = `✗ Error: ${(e.result as any)?.error || 'Failed'}`;
    }

    return {
      id: `${e.tool}-${i}`,
      icon,
      label,
      status: isStart ? 'active' as const : isError ? 'error' as const : 'done' as const,
      timestamp: new Date(),
    };
  });
}
