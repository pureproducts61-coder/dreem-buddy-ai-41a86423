import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Zap,
  FolderKanban,
  Settings,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeToggle, LanguageToggle } from '@/components/ThemeLanguageToggle';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const navItems = [
  { key: 'sidebar.projects', icon: FolderKanban, path: '/' },
  { key: 'sidebar.settings', icon: Settings, path: '/settings' },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { logout, user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300',
        collapsed ? 'w-14' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className="flex h-11 items-center border-b border-border/50 px-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/30 text-primary">
          <Zap className="h-3.5 w-3.5" />
        </div>
        {!collapsed && (
          <span className="ml-2 font-display text-xs font-bold tracking-wider uppercase text-primary">
            Dreem Dev
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          const linkContent = (
            <NavLink
              to={item.path}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-mono transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{t(item.key)}</span>}
            </NavLink>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.key}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right">{t(item.key)}</TooltipContent>
              </Tooltip>
            );
          }
          return <div key={item.key}>{linkContent}</div>;
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/50 p-2 space-y-1">
        <div className="flex justify-center gap-0.5">
          <ThemeToggle />
          <LanguageToggle />
        </div>

        {!collapsed && user && (
          <div className="px-3 py-1">
            <p className="truncate text-[10px] font-mono text-muted-foreground/60">
              {user.email}
            </p>
          </div>
        )}

        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={logout} className="w-full h-8">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{t('sidebar.signOut')}</TooltipContent>
          </Tooltip>
        ) : (
          <Button variant="ghost" onClick={logout} className="w-full justify-start gap-2 text-xs font-mono h-8">
            <LogOut className="h-3.5 w-3.5" />
            {t('sidebar.signOut')}
          </Button>
        )}

        <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} className="w-full h-7">
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </aside>
  );
}
