import { useRef, useEffect, useState } from 'react';
import { Copy, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { StreamingMessage } from './StreamingMessage';
import tivoLogo from '@/assets/tivo-logo.png';
import type { ToolEvent } from '@/services/aiChatService';

interface PlanMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolEvents?: ToolEvent[];
}

interface PlanChatProps {
  messages: PlanMessage[];
  isLoading: boolean;
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="h-7 px-2 rounded-md inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors opacity-0 group-hover:opacity-100"
      aria-label="Copy message"
    >
      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function PlanChat({ messages, isLoading }: PlanChatProps) {
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
    <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
     <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-8">
      <AnimatePresence mode="popLayout">
        {messages.map((msg, idx) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn('group', msg.role === 'user' ? 'flex justify-end' : '')}
          >
            {msg.role === 'user' ? (
              <div className="max-w-[85%] rounded-3xl bg-secondary/70 border border-border/40 text-foreground px-4 py-2.5 text-[15px] leading-relaxed shadow-sm">
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-sm">
                    <img src={tivoLogo} alt="" className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">TIVO AI</span>
                  <span className="ml-auto"><CopyButton content={msg.content} /></span>
                </div>
                <StreamingMessage
                  content={msg.content}
                  isLatest={idx === messages.length - 1 && msg.role === 'assistant'}
                />
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {isLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5 py-2">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Sparkles className="h-3 w-3 text-primary-foreground animate-pulse" />
          </div>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: '120ms' }} />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: '240ms' }} />
          </div>
          <span className="text-xs text-muted-foreground">TIVO AI is thinking…</span>
        </motion.div>
      )}
     </div>
    </div>
  );
}
