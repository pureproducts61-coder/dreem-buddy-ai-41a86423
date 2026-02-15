import { useState } from 'react';
import { Pencil, Upload, Trash2, Zap, Plus, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProjects } from '@/contexts/ProjectContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export function ProjectVault() {
  const { t } = useLanguage();
  const { projects } = useProjects();
  const [automationEnabled, setAutomationEnabled] = useState<Record<string, boolean>>({});

  const toggleAutomation = (id: string) => {
    setAutomationEnabled(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <h2 className="text-xl font-display font-bold tracking-tight">{t('vault.title')}</h2>
        <p className="text-xs text-muted-foreground mt-1">{t('vault.subtitle')}</p>
      </div>

      {/* Projects */}
      <div className="flex-1 px-4 pb-4 space-y-3">
        {projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="h-16 w-16 rounded-2xl glass-card flex items-center justify-center mb-4">
              <FolderOpen className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t('vault.empty')}</p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{project.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{project.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs rounded-xl">
                    <Pencil className="h-3 w-3" />
                    {t('vault.edit')}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs rounded-xl text-success">
                    <Upload className="h-3 w-3" />
                    {t('vault.publish')}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs rounded-xl text-destructive">
                    <Trash2 className="h-3 w-3" />
                    {t('vault.delete')}
                  </Button>
                  <button
                    onClick={() => toggleAutomation(project.id)}
                    className={cn(
                      'ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-medium transition-all',
                      automationEnabled[project.id]
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-secondary text-muted-foreground'
                    )}
                  >
                    <Zap className="h-3 w-3" />
                    Auto
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
