import { useState } from 'react';
import tivoLogo from '@/assets/tivo-logo.png';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { ThemeToggle, LanguageToggle } from '@/components/ThemeLanguageToggle';
import { cn } from '@/lib/utils';

interface HeaderMenuProps {
  onSettingsClick: () => void;
}

export function HeaderMenu({ onSettingsClick }: HeaderMenuProps) {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border/15">
      <div className="flex items-center gap-2 shrink-0">
        <img src={tivoLogo} alt="TIVO" className="w-6 h-6 drop-shadow-[0_0_8px_rgba(204,0,0,0.4)]" />
        <span className="text-sm font-display font-bold tracking-tight gradient-text-brand">TIVO</span>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        <ThemeToggle />
        <LanguageToggle />
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onSettingsClick}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
