import { useState, useRef, useEffect } from 'react';
import { Copy, Check, Loader2, FileCode } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { StreamingMessage } from './StreamingMessage';
import tivoLogo from '@/assets/tivo-logo.png';
import type { ToolEvent } from '@/services/aiChatService';

interface BuildMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolEvents?: ToolEvent[];
}

interface BuildWorkspaceProps {
  messages: BuildMessage[];
  isLoading: boolean;
  onOpenMenu: () => void;
  activeFiles?: string[];
}

function getActiveFileNames(events: ToolEvent[]): string[] {
  const files: string[] = [];
  for (const e of events) {
    if (e.args?.path && typeof e.args.path === 'string') files.push(e.args.path);
    if (e.args?.name && typeof e.args.name === 'string') files.push(e.args.name);
    if (e.result?.path && typeof e.result.path === 'string') files.push(e.result.path);
  }
  return [...new Set(files)];
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100">
      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export function BuildWorkspace({ messages, isLoading, onOpenMenu, activeFiles = [] }: BuildWorkspaceProps) {
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    if (isNearBottom.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        <AnimatePresence mode="popLayout">
          {messages.map((msg, idx) => {
            const fileNames = msg.toolEvents ? getActiveFileNames(msg.toolEvents) : [];
            const isLatest = idx === messages.length - 1 && msg.role === 'assistant';

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn('group', msg.role === 'user' ? 'flex justify-end' : '')}
              >
                {msg.role === 'user' ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-3 text-sm">
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <img src={tivoLogo} alt="TIVO" className="w-4 h-4" />
                      <span className="text-[11px] font-medium text-muted-foreground">TIVO AI</span>
                      <CopyButton content={msg.content} />
                    </div>

                    {fileNames.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {fileNames.map((f, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-secondary text-muted-foreground">
                            <FileCode className="h-2.5 w-2.5" />
                            {f.split('/').pop()}
                          </span>
                        ))}
                      </div>
                    )}

                    <StreamingMessage content={msg.content} isLatest={isLatest} />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 py-2">
            <img src={tivoLogo} alt="TIVO" className="w-4 h-4" />
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            {activeFiles.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <FileCode className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-mono">{activeFiles[activeFiles.length - 1]}</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Working...</span>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
