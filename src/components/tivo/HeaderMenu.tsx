import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeToggle, LanguageToggle } from '@/components/ThemeLanguageToggle';
import { cn } from '@/lib/utils';

type HeaderTab = 'automated' | 'built' | 'published' | 'chatHistory';

interface HeaderMenuProps {
  onSettingsClick: () => void;
}

export function HeaderMenu({ onSettingsClick }: HeaderMenuProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<HeaderTab | null>(null);

  const tabs: HeaderTab[] = ['automated', 'built', 'published', 'chatHistory'];

  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border/15">
      {/* Brand */}
      <div className="flex items-center gap-2 shrink-0 mr-3">
        <span className="text-sm">❤️</span>
        <span className="text-sm font-display font-bold tracking-tight gradient-text-brand">TIVO</span>
      </div>

      {/* Tabs */}
      <div className="flex-1 flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(activeTab === tab ? null : tab)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all',
              activeTab === tab
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            )}
          >
            {t(`header.${tab}`)}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0 ml-2">
        <ThemeToggle />
        <LanguageToggle />
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onSettingsClick}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
