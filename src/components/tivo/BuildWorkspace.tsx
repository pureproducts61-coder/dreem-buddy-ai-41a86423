import { useState } from 'react';
import { Eye, MoreVertical, ExternalLink, Loader2, Code, ThumbsUp, ThumbsDown, Copy, Check, Brain, Zap, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useRef, useEffect } from 'react';
import { StreamingMessage } from './StreamingMessage';
import { ToolCallStatus } from './ToolCallStatus';
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
}

function BuildMessageActions({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<'like' | 'dislike' | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onClick={() => setLiked(liked === 'like' ? null : 'like')}
        className={cn('h-7 w-7 rounded-lg flex items-center justify-center transition-colors',
          liked === 'like' ? 'bg-success/15 text-success' : 'text-muted-foreground hover:text-foreground hover:bg-secondary')}>
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => setLiked(liked === 'dislike' ? null : 'dislike')}
        className={cn('h-7 w-7 rounded-lg flex items-center justify-center transition-colors',
          liked === 'dislike' ? 'bg-destructive/15 text-destructive' : 'text-muted-foreground hover:text-foreground hover:bg-secondary')}>
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
      <button onClick={handleCopy}
        className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export function BuildWorkspace({ messages, isLoading, onOpenMenu }: BuildWorkspaceProps) {
  const { t } = useLanguage();
  const [showPreview, setShowPreview] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        <AnimatePresence mode="popLayout">
          {messages.map((msg, idx) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('group', msg.role === 'user' ? 'flex justify-end' : '')}
            >
              {msg.role === 'user' ? (
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-3 text-sm">
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <img src={tivoLogo} alt="TIVO" className="w-4 h-4" />
                    <span className="text-[11px] font-medium text-muted-foreground">TIVO AI</span>
                  </div>
                  {msg.toolEvents && msg.toolEvents.length > 0 && (
                    <ToolCallStatus events={msg.toolEvents} />
                  )}
                  <StreamingMessage
                    content={msg.content}
                    isLatest={idx === messages.length - 1 && msg.role === 'assistant'}
                  />
                  <BuildMessageActions content={msg.content} />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <div className="flex items-center gap-2">
              <img src={tivoLogo} alt="TIVO" className="w-4 h-4" />
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">{t('build.thinking')}</span>
            </div>
            <div className="flex items-center gap-3 ml-6">
              <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}
                className="flex items-center gap-1 text-[10px] text-primary">
                <Brain className="h-3 w-3" /> Think
              </motion.div>
              <motion.div animate={{ opacity: [0.2, 0.8, 0.2] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Zap className="h-3 w-3" /> Act
              </motion.div>
              <motion.div animate={{ opacity: [0.2, 0.6, 0.2] }} transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" /> Review
              </motion.div>
            </div>
            <div className="h-1 w-32 rounded-full bg-secondary overflow-hidden ml-6">
              <motion.div className="h-full bg-primary/50 rounded-full" animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} style={{ width: '50%' }} />
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border/20">
        <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)} className="gap-1.5 text-xs">
          <Eye className="h-3.5 w-3.5" />
          {t('build.preview')}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenMenu}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>

      {/* Preview Panel */}
      <AnimatePresence>
        {showPreview && (
          <motion.div initial={{ height: 0 }} animate={{ height: '50%' }} exit={{ height: 0 }}
            className="border-t border-border/20 overflow-hidden bg-card/50 backdrop-blur-xl">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Code className="h-3 w-3" /> {t('build.preview')}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6"><ExternalLink className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowPreview(false)}>×</Button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center h-full text-muted-foreground/40">
              <p className="text-sm">{t('build.noProject')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
