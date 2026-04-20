import { X, Settings, LogOut, Shield, User, Mail, Coins, Activity, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle, LanguageToggle } from '@/components/ThemeLanguageToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ControlPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ControlPanel({ open, onClose }: ControlPanelProps) {
  const { logout, user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const initials = (user?.email || 'U').slice(0, 2).toUpperCase();
  const role = isAdmin ? 'Admin' : 'User';

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl glass-panel-strong border-t border-border/40 max-h-[88vh] overflow-y-auto"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
            </div>

            {/* Close */}
            <div className="flex justify-end px-3 pb-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* PROFILE HEADER */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-4 mb-4 rounded-2xl bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 p-4"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'h-12 w-12 rounded-2xl flex items-center justify-center font-display font-bold text-base shrink-0',
                  isAdmin
                    ? 'bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg shadow-primary/30'
                    : 'bg-secondary text-foreground'
                )}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold truncate">{user?.email?.split('@')[0] || 'User'}</p>
                    <Badge
                      variant={isAdmin ? 'default' : 'secondary'}
                      className="text-[9px] px-1.5 py-0 h-4 gap-0.5"
                    >
                      {isAdmin && <Shield className="h-2.5 w-2.5" />}
                      {role}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                    <Mail className="h-2.5 w-2.5" />
                    {user?.email || '—'}
                  </p>
                </div>
              </div>

              {/* Role-based stats */}
              {isAdmin ? (
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/30">
                  <StatChip icon={Activity} label="Status" value="Active" tone="success" />
                  <StatChip icon={Sparkles} label="Access" value="Full" tone="primary" />
                  <StatChip icon={Coins} label="Credits" value="∞" tone="primary" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/30">
                  <StatChip icon={Activity} label="Status" value="Active" tone="success" />
                  <StatChip icon={Coins} label="Credits" value="50" tone="primary" />
                </div>
              )}
            </motion.div>

            {/* APPEARANCE — vertical, mobile-friendly */}
            <div className="mx-4 mb-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 mb-2 px-1">
                Appearance
              </p>
              <div className="rounded-2xl border border-border/40 bg-card/50 divide-y divide-border/30 overflow-hidden">
                <SettingRow icon={null} label="Theme">
                  <ThemeToggle />
                </SettingRow>
                <SettingRow icon={null} label="Language">
                  <LanguageToggle />
                </SettingRow>
              </div>
            </div>

            {/* ACCOUNT — vertical actions */}
            <div className="mx-4 mb-3">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 mb-2 px-1">
                Account
              </p>
              <div className="rounded-2xl border border-border/40 bg-card/50 divide-y divide-border/30 overflow-hidden">
                <ActionRow
                  icon={User}
                  label="Profile & Settings"
                  hint="Account & preferences"
                  onClick={() => { onClose(); navigate('/settings'); }}
                />
                {isAdmin && (
                  <ActionRow
                    icon={Shield}
                    label="Admin Panel"
                    hint="Users, credits, system status"
                    accent="primary"
                    onClick={() => { onClose(); navigate('/admin'); }}
                  />
                )}
                <ActionRow
                  icon={LogOut}
                  label="Sign out"
                  hint="End this session"
                  accent="destructive"
                  onClick={() => { onClose(); logout(); navigate('/login'); }}
                />
              </div>
            </div>

            <div className="h-[env(safe-area-inset-bottom)]" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* — small subcomponents — */

function StatChip({
  icon: Icon, label, value, tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone: 'success' | 'primary';
}) {
  const toneClass = tone === 'success'
    ? 'text-emerald-500'
    : 'text-primary';
  return (
    <div className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg bg-background/40">
      <Icon className={cn('h-3 w-3', toneClass)} />
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-xs font-semibold">{value}</p>
    </div>
  );
}

function SettingRow({
  icon: Icon, label, children,
}: {
  icon: React.ElementType | null;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

function ActionRow({
  icon: Icon, label, hint, accent, onClick,
}: {
  icon: React.ElementType;
  label: string;
  hint?: string;
  accent?: 'primary' | 'destructive';
  onClick: () => void;
}) {
  const accentClass =
    accent === 'destructive'
      ? 'text-destructive hover:bg-destructive/10'
      : accent === 'primary'
        ? 'text-primary hover:bg-primary/10'
        : 'hover:bg-secondary/60';
  return (
    <button
      onClick={onClick}
      className={cn('w-full flex items-center gap-3 px-4 py-3 transition-colors text-left', accentClass)}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground/80">{hint}</p>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
    </button>
  );
}
