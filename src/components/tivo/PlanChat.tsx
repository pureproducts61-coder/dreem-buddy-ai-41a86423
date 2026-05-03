import { useRef, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { StreamingMessage } from './StreamingMessage';
import { UserMessageBubble } from './UserMessageBubble';
import { TaskExecutionCard } from './TaskExecutionCard';
import tivoLogo from '@/assets/tivo-logo.png';
import type { ToolEvent } from '@/services/aiChatService';

interface PlanMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolEvents?: ToolEvent[];
  durationMs?: number;
  creditsUsed?: number;
}

interface PlanChatProps {
  messages: PlanMessage[];
  isLoading: boolean;
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
              <UserMessageBubble content={msg.content} />
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-sm">
                    <img src={tivoLogo} alt="" className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">TIVO AI</span>
                </div>
                {msg.toolEvents && msg.toolEvents.length > 0 && (
                  <TaskExecutionCard
                    events={msg.toolEvents}
                    isActive={isLoading && idx === messages.length - 1}
                    durationMs={msg.durationMs}
                    creditsUsed={msg.creditsUsed}
                    onCopy={() => navigator.clipboard.writeText(msg.content)}
                  />
                )}
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
