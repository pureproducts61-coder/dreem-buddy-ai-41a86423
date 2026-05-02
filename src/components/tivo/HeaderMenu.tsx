import { useEffect, useRef } from 'react';
import tivoLogo from '@/assets/tivo-logo.png';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getCustomDbConfig, isUsingCustomDb } from '@/services/customSupabaseService';

interface HeaderMenuProps {
  onSettingsClick: () => void;
}

export function HeaderMenu({ onSettingsClick }: HeaderMenuProps) {
  const { toast } = useToast();
  const notified = useRef(false);

  useEffect(() => {
    if (notified.current) return;
    const cfg = getCustomDbConfig();
    const seenKey = 'tivo-custom-db-notified';
    if (cfg && !localStorage.getItem(seenKey)) {
      notified.current = true;
      localStorage.setItem(seenKey, '1');
      toast({
        title: isUsingCustomDb() ? '🔌 Custom Supabase সক্রিয়' : '🔌 Custom Supabase শনাক্ত হয়েছে',
        description: 'Vercel env থেকে কাস্টম DB কনফিগ লোড হয়েছে। Admin → System → Custom DB থেকে schema setup ও data migration চালান।',
      });
    }
  }, [toast]);

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
