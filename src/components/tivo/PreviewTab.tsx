import { useState, useRef, useCallback, useEffect } from 'react';
import { Globe, Smartphone, Tablet, Monitor, RefreshCw, ExternalLink, Terminal, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DeviceConfig {
  key: string;
  icon: typeof Smartphone;
  width: number | string;
  frame?: string;
}

const devices: DeviceConfig[] = [
  { key: 'mobile', icon: Smartphone, width: 375, frame: 'android' },
  { key: 'tablet', icon: Tablet, width: 768 },
  { key: 'desktop', icon: Monitor, width: '100%', frame: 'windows' },
];

interface ConsoleEntry {
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: Date;
}

export function PreviewTab() {
  const { t } = useLanguage();
  const [device, setDevice] = useState<string>('desktop');
  const [url, setUrl] = useState('');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Generate blob URL from HTML content for hot-reload
  const loadFromHtml = useCallback((html: string) => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    const blob = new Blob([html], { type: 'text/html' });
    const newUrl = URL.createObjectURL(blob);
    setBlobUrl(newUrl);
    setUrl('');
  }, [blobUrl]);

  // Listen for project preview events
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail?.html) {
        loadFromHtml(e.detail.html);
      } else if (e.detail?.url) {
        setUrl(e.detail.url);
        setBlobUrl(null);
      }
    };
    window.addEventListener('tivo-preview-update', handler as EventListener);
    return () => window.removeEventListener('tivo-preview-update', handler as EventListener);
  }, [loadFromHtml]);

  // Listen for console messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'tivo-console') {
        setConsoleLogs(prev => [...prev.slice(-99), {
          type: e.data.level || 'log',
          message: e.data.message,
          timestamp: new Date(),
        }]);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);

  const previewSrc = blobUrl || url;
  const currentDevice = devices.find(d => d.key === device) || devices[2];

  const consoleColors: Record<string, string> = {
    error: 'text-red-400',
    warn: 'text-yellow-400',
    info: 'text-blue-400',
    log: 'text-foreground/80',
  };

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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => setRefreshKey(k => k + 1)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => setConsoleOpen(o => !o)}
          >
            <Terminal className={cn('h-3.5 w-3.5', consoleLogs.some(l => l.type === 'error') && 'text-red-400')} />
          </Button>
          {previewSrc && !blobUrl && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => window.open(previewSrc, '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* URL bar */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2">
          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            value={blobUrl ? '(live preview)' : url}
            onChange={(e) => { setUrl(e.target.value); setBlobUrl(null); }}
            placeholder="https://your-project.vercel.app"
            readOnly={!!blobUrl}
            className="flex-1 bg-transparent text-xs font-mono text-muted-foreground outline-none placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      {/* Preview area with device frame */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        <motion.div
          key={device}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            'h-full overflow-hidden flex flex-col',
            device === 'mobile' && 'max-w-[375px] w-full rounded-[2.5rem] border-[3px] border-foreground/20 shadow-2xl',
            device === 'tablet' && 'max-w-[768px] w-full rounded-2xl border-2 border-foreground/15 shadow-xl',
            device === 'desktop' && 'w-full rounded-xl border border-border/30'
          )}
        >
          {/* Device frame header */}
          {device === 'mobile' && (
            <div className="h-8 bg-foreground/5 flex items-center justify-center shrink-0">
              <div className="h-4 w-20 rounded-full bg-foreground/10" />
            </div>
          )}
          {device === 'desktop' && (
            <div className="h-8 bg-foreground/5 flex items-center px-3 gap-1.5 shrink-0 border-b border-border/20">
              <div className="h-3 w-3 rounded-full bg-red-400/60" />
              <div className="h-3 w-3 rounded-full bg-yellow-400/60" />
              <div className="h-3 w-3 rounded-full bg-green-400/60" />
              <span className="ml-3 text-[10px] text-muted-foreground/50 font-mono truncate">
                {blobUrl ? 'Live Preview' : url || 'Preview'}
              </span>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 bg-white dark:bg-zinc-900 overflow-hidden">
            {previewSrc ? (
              <iframe
                ref={iframeRef}
                key={refreshKey}
                src={previewSrc}
                className="w-full h-full border-0"
                title="Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-background">
                <div className="text-center p-8">
                  <Globe className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground/60">{t('preview.empty')}</p>
                  <p className="text-xs text-muted-foreground/40 mt-1">AI বিল্ড করলে এখানে দেখাবে</p>
                </div>
              </div>
            )}
          </div>

          {/* Mobile bottom bar */}
          {device === 'mobile' && (
            <div className="h-5 bg-foreground/5 flex items-center justify-center shrink-0">
              <div className="h-1 w-24 rounded-full bg-foreground/15" />
            </div>
          )}
        </motion.div>
      </div>

      {/* Console Log Window */}
      <AnimatePresence>
        {consoleOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 160, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border/30 bg-zinc-950 overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/20">
              <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                <Terminal className="h-3 w-3" />
                Console ({consoleLogs.length})
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setConsoleLogs([])}
                >
                  <X className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setConsoleOpen(false)}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="overflow-y-auto h-[130px] px-3 py-1 space-y-0.5">
              {consoleLogs.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/40 font-mono py-2">No logs yet</p>
              ) : (
                consoleLogs.map((log, i) => (
                  <div key={i} className={cn('text-[11px] font-mono', consoleColors[log.type])}>
                    <span className="text-muted-foreground/40 mr-2">
                      {log.timestamp.toLocaleTimeString('en', { hour12: false })}
                    </span>
                    {log.type !== 'log' && (
                      <span className="mr-1">[{log.type.toUpperCase()}]</span>
                    )}
                    {log.message}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
