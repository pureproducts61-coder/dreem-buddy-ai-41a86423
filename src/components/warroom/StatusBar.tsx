import { Cpu, HardDrive, Wifi, WifiOff, Activity } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface StatusBarProps {
  cpuUsage: number;
  memoryUsage: number;
  keepAlive: boolean;
  backendUrl: string;
}

export function StatusBar({ cpuUsage = 42, memoryUsage = 67, keepAlive = true, backendUrl = '' }: StatusBarProps) {
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-between border-t border-border/50 bg-card/80 px-4 py-1.5 text-xs font-mono">
      {/* Left: Health */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Cpu className="h-3 w-3 text-primary" />
          <span className="text-muted-foreground">{t('warroom.cpu')}:</span>
          <span className={cn(cpuUsage > 80 ? 'text-destructive' : 'text-neon-green')}>{cpuUsage}%</span>
          <Progress value={cpuUsage} className="w-16 h-1.5" />
        </div>
        <div className="flex items-center gap-1.5">
          <HardDrive className="h-3 w-3 text-primary" />
          <span className="text-muted-foreground">{t('warroom.memory')}:</span>
          <span className={cn(memoryUsage > 80 ? 'text-destructive' : 'text-neon-green')}>{memoryUsage}%</span>
          <Progress value={memoryUsage} className="w-16 h-1.5" />
        </div>
      </div>

      {/* Center: Backend URL */}
      <div className="hidden md:flex items-center gap-1.5 text-muted-foreground/60">
        <Activity className="h-3 w-3" />
        <span className="max-w-[200px] truncate">{backendUrl || 'No backend'}</span>
      </div>

      {/* Right: Keep-Alive */}
      <div className="flex items-center gap-1.5">
        {keepAlive ? (
          <>
            <Wifi className="h-3 w-3 text-neon-green" />
            <span className="text-neon-green">{t('warroom.keepAlive')}: ON</span>
            <span className="flex h-1.5 w-1.5 rounded-full bg-neon-green animate-pulse" />
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3 text-destructive" />
            <span className="text-destructive">{t('warroom.keepAlive')}: OFF</span>
          </>
        )}
      </div>
    </div>
  );
}
