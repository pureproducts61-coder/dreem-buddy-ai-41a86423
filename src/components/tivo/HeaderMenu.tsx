import { useState } from 'react';
import tivoLogo from '@/assets/tivo-logo.png';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface HeaderMenuProps {
  onSettingsClick: () => void;
}

export function HeaderMenu({ onSettingsClick }: HeaderMenuProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border/15">
      <div className="flex items-center gap-2.5 shrink-0">
        <img src={tivoLogo} alt="TIVO" className="w-9 h-9 drop-shadow-[0_0_10px_rgba(204,0,0,0.5)]" />
        <span className="text-lg font-display font-bold tracking-tight gradient-text-brand">TIVO AI</span>
      </div>

      <div className="flex items-center shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 rounded-2xl hover:bg-secondary/60"
          onClick={onSettingsClick}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
