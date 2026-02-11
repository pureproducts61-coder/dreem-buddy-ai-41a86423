import { useState } from 'react';
import { Settings, Menu } from 'lucide-react';
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
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/20">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(activeTab === tab ? null : tab)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
              activeTab === tab
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
          >
            {t(`header.${tab}`)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <ThemeToggle />
        <LanguageToggle />
      </div>
    </header>
  );
}
