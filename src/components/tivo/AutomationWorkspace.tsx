import { useState } from 'react';
import { Zap, FolderOpen, Play, ChevronRight, Clock, CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProjects } from '@/contexts/ProjectContext';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { requestApproval, waitForDecision } from '@/services/approvalService';
import { getKillSwitch, refreshKillSwitch } from '@/services/killSwitchService';

interface AutomationWorkspaceProps {
  isLoading: boolean;
}

export function AutomationWorkspace({ isLoading }: AutomationWorkspaceProps) {
  const { t } = useLanguage();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const { projects } = useProjects();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [automationLogs, setAutomationLogs] = useState<string[]>([]);
  const [waiting, setWaiting] = useState(false);

  const runAutomation = async () => {
    if (!selectedProject) return;
    setAutomationLogs([]);

    // Kill-switch gate
    if (!isAdmin) {
      await refreshKillSwitch();
      const ks = getKillSwitch();
      if (ks.kill_switch) {
        toast({ title: '🛑 Halted by admin', description: ks.reason || 'Kill-switch is engaged.', variant: 'destructive' });
        return;
      }
    }

    const project = projects.find(p => p.id === selectedProject);
    setAutomationLogs([`Requesting admin approval for "${project?.name || selectedProject}"...`]);
    setWaiting(true);
    try {
      const approval = isAdmin ? null : await requestApproval({
        userId: user?.id || '',
        userEmail: user?.email || null,
        actionType: 'automation_run',
        title: `Run automation on ${project?.name || selectedProject}`,
        details: { project_id: selectedProject, project_name: project?.name },
      });

      if (approval) {
        setAutomationLogs(l => [...l, '⏳ Waiting for admin verification…']);
        const decision = await waitForDecision(approval.id);
        if (decision !== 'approved') {
          setAutomationLogs(l => [...l, decision === 'rejected' ? '❌ Admin rejected the request.' : '⌛ Approval timed out.']);
          toast({ title: decision === 'rejected' ? 'Rejected' : 'Timed out', variant: 'destructive' });
          setWaiting(false);
          return;
        }
        setAutomationLogs(l => [...l, '✅ Approved by admin. Running…']);
      }

      setAutomationLogs(l => [...l,
        'Analyzing project structure...',
        'Running tests...',
        'Generating report...',
      ]);
    } finally {
      setWaiting(false);
    }
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
            disabled={isLoading || waiting}
          >
            {waiting ? <ShieldAlert className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
            {waiting ? 'Awaiting admin verify…' : t('automation.runLogic')}
          </Button>
          {!isAdmin && (
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Major actions require admin approval — they appear in the Admin → Monitor tab.
            </p>
          )}
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
