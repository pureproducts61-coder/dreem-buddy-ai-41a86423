import { useState } from 'react';
import { Globe, Smartphone, Tablet, Monitor, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const devices = [
  { key: 'mobile', icon: Smartphone, width: 375 },
  { key: 'tablet', icon: Tablet, width: 768 },
  { key: 'desktop', icon: Monitor, width: '100%' },
] as const;

export function PreviewTab() {
  const { t } = useLanguage();
  const [device, setDevice] = useState<string>('mobile');
  const [url, setUrl] = useState('');

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
        <div className="flex items-center gap-1">
          {devices.map((d) => {
            const Icon = d.icon;
            return (
              <button
                key={d.key}
                onClick={() => setDevice(d.key)}
                className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center transition-all',
                  device === d.key
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* URL bar */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2">
          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-project.vercel.app"
            className="flex-1 bg-transparent text-xs font-mono text-muted-foreground outline-none placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            'h-full rounded-2xl glass-card overflow-hidden flex items-center justify-center',
            device === 'mobile' && 'max-w-[375px] w-full',
            device === 'tablet' && 'max-w-[768px] w-full',
            device === 'desktop' && 'w-full'
          )}
        >
          {url ? (
            <iframe src={url} className="w-full h-full border-0" title="Preview" />
          ) : (
            <div className="text-center p-8">
              <Globe className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground/60">{t('preview.empty')}</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
