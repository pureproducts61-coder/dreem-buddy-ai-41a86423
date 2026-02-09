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
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

type DeviceType = 'mobile' | 'tablet' | 'desktop';

const deviceSizes: Record<DeviceType, { width: string; label: string }> = {
  mobile: { width: '375px', label: 'Mobile' },
  tablet: { width: '768px', label: 'Tablet' },
  desktop: { width: '100%', label: 'Desktop' },
};

interface PreviewPanelProps {
  projectId: string;
}

export function PreviewPanel({ projectId }: PreviewPanelProps) {
  const { t } = useLanguage();
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [currentUrl, setCurrentUrl] = useState('/');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="flex h-full flex-col bg-muted/30">
      {/* Preview Header */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-2">
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={device}
            onValueChange={(v) => v && setDevice(v as DeviceType)}
            className="gap-1"
          >
            <ToggleGroupItem
              value="mobile"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="Mobile view"
            >
              <Smartphone className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="tablet"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="Tablet view"
            >
              <Tablet className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="desktop"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="Desktop view"
            >
              <Monitor className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex flex-1 items-center gap-2 px-4">
          <div className="relative flex-1 max-w-md">
            <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={currentUrl}
              onChange={(e) => setCurrentUrl(e.target.value)}
              className="h-8 pl-9 text-xs font-mono"
              placeholder="/"
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview Frame */}
      <div className="flex flex-1 items-start justify-center overflow-auto p-4">
        <div
          className={cn(
            'h-full bg-background rounded-lg shadow-xl overflow-hidden transition-all duration-300',
            device !== 'desktop' && 'border-8 border-foreground/10 rounded-3xl'
          )}
          style={{
            width: deviceSizes[device].width,
            maxWidth: '100%',
          }}
        >
          {/* Demo Preview Content */}
          <div
            key={refreshKey}
            className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 text-center p-8"
          >
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Monitor className="h-10 w-10" />
            </div>
            <h2 className="mb-2 text-xl font-bold">{t('workspace.previewTitle')}</h2>
            <p className="text-sm text-muted-foreground max-w-[300px]">
              {t('workspace.previewDesc')}
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              {t('workspace.livePreview')}
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between border-t bg-background px-4 py-1.5 text-xs text-muted-foreground">
        <span>{deviceSizes[device].label} — {deviceSizes[device].width}</span>
        <span className="flex items-center gap-1">
          <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
          Ready
        </span>
      </div>
    </div>
  );
}
