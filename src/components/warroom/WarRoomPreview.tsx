import { useState } from 'react';
import {
  RefreshCw,
  Smartphone,
  Tablet,
  Monitor,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

type DeviceType = 'mobile' | 'tablet' | 'desktop';

const deviceSizes: Record<DeviceType, { width: string; label: string }> = {
  mobile: { width: '375px', label: 'Mobile' },
  tablet: { width: '768px', label: 'Tablet' },
  desktop: { width: '100%', label: 'Desktop' },
};

export function WarRoomPreview() {
  const { t } = useLanguage();
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [currentUrl, setCurrentUrl] = useState('/');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex h-full flex-col">
      {/* Preview Header */}
      <div className="flex items-center justify-between border-b border-border/50 bg-card/50 px-3 py-1.5">
        <ToggleGroup type="single" value={device} onValueChange={(v) => v && setDevice(v as DeviceType)} className="gap-0.5">
          <ToggleGroupItem value="mobile" size="sm" className="h-7 w-7 p-0"><Smartphone className="h-3 w-3" /></ToggleGroupItem>
          <ToggleGroupItem value="tablet" size="sm" className="h-7 w-7 p-0"><Tablet className="h-3 w-3" /></ToggleGroupItem>
          <ToggleGroupItem value="desktop" size="sm" className="h-7 w-7 p-0"><Monitor className="h-3 w-3" /></ToggleGroupItem>
        </ToggleGroup>
        <div className="flex flex-1 items-center gap-1.5 px-3 max-w-xs">
          <Globe className="h-3 w-3 text-muted-foreground" />
          <Input value={currentUrl} onChange={(e) => setCurrentUrl(e.target.value)} className="h-6 text-[10px] font-mono bg-secondary/30 border-none px-2" />
        </div>
        <div className="flex gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRefreshKey(k => k + 1)}><RefreshCw className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="h-3 w-3" /></Button>
        </div>
      </div>

      {/* Preview Frame */}
      <div className="flex flex-1 items-start justify-center overflow-auto p-3 bg-secondary/20">
        <div
          className={cn(
            'h-full bg-background rounded-lg shadow-xl overflow-hidden transition-all duration-300',
            device !== 'desktop' && 'border-4 border-border/30 rounded-2xl'
          )}
          style={{ width: deviceSizes[device].width, maxWidth: '100%' }}
        >
          <div key={refreshKey} className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 text-center p-8">
            <Monitor className="h-10 w-10 text-primary/50 mb-4" />
            <h3 className="font-display text-sm font-semibold text-primary/70 tracking-wider">{t('warroom.preview')}</h3>
            <p className="text-xs text-muted-foreground mt-1">Deploy a project to see live preview</p>
            <span className="mt-4 flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
              <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Awaiting deployment...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
