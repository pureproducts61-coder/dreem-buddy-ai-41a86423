import { X, Upload, Pencil, GitBranch, History, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ControlPanelProps {
  open: boolean;
  onClose: () => void;
}

const menuItems = [
  { key: 'publish', icon: Upload, accent: 'text-neon-green' },
  { key: 'edit', icon: Pencil, accent: 'text-primary' },
  { key: 'deploy', icon: GitBranch, accent: 'text-neon-purple' },
  { key: 'history', icon: History, accent: 'text-neon-orange' },
];

export function ControlPanel({ open, onClose }: ControlPanelProps) {
  const { t } = useLanguage();
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl glass-panel-strong border-t border-border/30 max-h-[55vh] overflow-y-auto"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Close */}
            <div className="flex justify-end px-4 pb-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Menu Items */}
            <div className="px-4 pb-4 space-y-1">
              {menuItems.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.button
                    key={item.key}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="w-full flex items-center gap-3 rounded-xl p-3.5 hover:bg-secondary/80 transition-colors text-left group"
                    onClick={onClose}
                  >
                    <div className={cn('h-9 w-9 rounded-xl bg-secondary flex items-center justify-center', item.accent)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t(`panel.${item.key}`)}</p>
                      <p className="text-xs text-muted-foreground">{t(`panel.${item.key}Desc`)}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Divider & Settings/Logout */}
            <div className="border-t border-border/30 mx-4" />
            <div className="px-4 py-3 space-y-1">
              <button
                onClick={() => { onClose(); navigate('/settings'); }}
                className="w-full flex items-center gap-3 rounded-xl p-3 hover:bg-secondary/80 transition-colors"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{t('settings.title')}</span>
              </button>
              <button
                onClick={() => { onClose(); logout(); navigate('/login'); }}
                className="w-full flex items-center gap-3 rounded-xl p-3 hover:bg-destructive/10 transition-colors text-destructive"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm">{t('settings.logout')}</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
