import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, FileCode, FolderGit2, Trash2, Eye, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { ToolEvent } from '@/services/aiChatService';

const toolMeta: Record<string, { icon: typeof GitBranch; label: string; color: string }> = {
  create_github_repo: { icon: FolderGit2, label: 'Creating repository', color: 'text-green-400' },
  write_file_to_github: { icon: FileCode, label: 'Writing file', color: 'text-blue-400' },
  push_multiple_files: { icon: GitBranch, label: 'Pushing files', color: 'text-purple-400' },
  list_repo_files: { icon: Eye, label: 'Listing files', color: 'text-yellow-400' },
  read_file_from_github: { icon: Eye, label: 'Reading file', color: 'text-cyan-400' },
  delete_github_repo: { icon: Trash2, label: 'Deleting repo', color: 'text-red-400' },
  create_branch: { icon: GitBranch, label: 'Creating branch', color: 'text-orange-400' },
  create_pull_request: { icon: GitBranch, label: 'Creating PR', color: 'text-pink-400' },
};

interface ToolCallStatusProps {
  events: ToolEvent[];
}

export function ToolCallStatus({ events }: ToolCallStatusProps) {
  if (events.length === 0) return null;

  return (
    <div className="space-y-1.5 my-2">
      <AnimatePresence>
        {events.map((event, i) => {
          const meta = toolMeta[event.tool] || { icon: GitBranch, label: event.tool, color: 'text-muted-foreground' };
          const Icon = meta.icon;
          const isStart = event.type === 'tool_start';
          const isSuccess = event.type === 'tool_result' && event.result && !event.result.error;
          const isError = event.type === 'tool_result' && event.result?.error;

          // Build description
          let desc = meta.label;
          if (isStart && event.args) {
            if (event.args.name) desc += `: ${event.args.name}`;
            else if (event.args.path) desc += `: ${event.args.path}`;
            else if (event.args.repo) desc += `: ${event.args.owner}/${event.args.repo}`;
          }
          if (event.type === 'tool_result' && event.result) {
            if (event.result.url) desc = `✓ Created: ${event.result.url}`;
            else if (event.result.files_pushed) desc = `✓ Pushed ${event.result.files_pushed} files`;
            else if (event.result.path) desc = `✓ ${event.result.path}`;
            else if (event.result.error) desc = `✗ ${event.result.error}`;
            else if (event.result.success) desc = `✓ Done`;
          }

          return (
            <motion.div
              key={`${event.tool}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 rounded-lg bg-secondary/50 border border-border/30 px-3 py-1.5 text-xs font-mono"
            >
              {isStart && <Loader2 className={`h-3.5 w-3.5 ${meta.color} animate-spin`} />}
              {isSuccess && <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />}
              {isError && <XCircle className="h-3.5 w-3.5 text-red-400" />}
              {!isStart && !isSuccess && !isError && <Icon className={`h-3.5 w-3.5 ${meta.color}`} />}
              <span className="text-muted-foreground truncate max-w-[400px]">{desc}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
