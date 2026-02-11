import { useState } from 'react';
import { Zap, FolderOpen, Play, ChevronRight, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProjects } from '@/contexts/ProjectContext';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AutomationWorkspaceProps {
  isLoading: boolean;
}

export function AutomationWorkspace({ isLoading }: AutomationWorkspaceProps) {
  const { t } = useLanguage();
  const { projects } = useProjects();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [automationLogs, setAutomationLogs] = useState<string[]>([]);

  const runAutomation = () => {
    if (!selectedProject) return;
    setAutomationLogs(['Analyzing project structure...', 'Running tests...', 'Generating report...']);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-8"
      >
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent mb-3">
          <Zap className="h-7 w-7 text-accent-foreground" />
        </div>
        <h2 className="text-lg font-semibold">{t('automation.title')}</h2>
      </motion.div>

      {/* Project List */}
      <div className="space-y-2">
        {projects.length > 0 ? (
          projects.map((project) => (
            <motion.button
              key={project.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setSelectedProject(project.id)}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl p-3 text-left transition-all',
                selectedProject === project.id
                  ? 'bg-primary/10 border border-primary/30'
                  : 'glass-panel hover:bg-secondary/80'
              )}
            >
              <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{project.name}</p>
                <p className="text-xs text-muted-foreground truncate">{project.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </motion.button>
          ))
        ) : (
          <p className="text-center text-sm text-muted-foreground py-8">
            {t('automation.noProjects')}
          </p>
        )}
      </div>

      {/* Run Button */}
      {selectedProject && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Button
            onClick={runAutomation}
            className="w-full gap-2 glow-primary"
            disabled={isLoading}
          >
            <Play className="h-4 w-4" />
            {t('automation.runLogic')}
          </Button>
        </motion.div>
      )}

      {/* Automation Logs */}
      {automationLogs.length > 0 && (
        <div className="space-y-2 mt-4">
          {automationLogs.map((log, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.3 }}
              className="flex items-center gap-2 text-xs font-mono text-muted-foreground"
            >
              {i < automationLogs.length - 1 ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
              ) : (
                <Clock className="h-3.5 w-3.5 text-warning animate-pulse shrink-0" />
              )}
              {log}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
