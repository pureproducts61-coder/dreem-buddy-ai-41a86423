import { Loader2, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface TaskStep {
  id: string;
  key: string;
  status: TaskStatus;
}

interface TaskSidebarProps {
  tasks: TaskStep[];
}

const defaultTasks: TaskStep[] = [
  { id: '1', key: 'warroom.planning', status: 'completed' },
  { id: '2', key: 'warroom.research', status: 'completed' },
  { id: '3', key: 'warroom.coding', status: 'in_progress' },
  { id: '4', key: 'warroom.testing', status: 'pending' },
  { id: '5', key: 'warroom.deploying', status: 'pending' },
];

export function TaskSidebar({ tasks = defaultTasks }: TaskSidebarProps) {
  const { t } = useLanguage();

  const statusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-neon-green" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground/30" />;
    }
  };

  return (
    <div className="flex flex-col">
      <div className="px-3 py-2 border-b border-border/50">
        <span className="text-xs font-display uppercase tracking-wider text-muted-foreground">
          {t('warroom.tasks')}
        </span>
      </div>
      <div className="p-2 space-y-1">
        {tasks.map((task, index) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-mono transition-colors',
              task.status === 'in_progress' && 'bg-primary/5 border border-primary/20',
              task.status === 'completed' && 'text-muted-foreground',
              task.status === 'pending' && 'text-muted-foreground/50',
            )}
          >
            {statusIcon(task.status)}
            <span className={cn(
              'text-xs',
              task.status === 'in_progress' && 'text-primary font-semibold',
            )}>
              {t(task.key)}
            </span>
            {/* Progress line */}
            {index < tasks.length - 1 && (
              <div className="absolute left-[23px] top-[32px] w-px h-3 bg-border/30" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
