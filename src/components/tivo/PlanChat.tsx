import { useRef, useEffect } from 'react';
import { Loader2, ThumbsUp, ThumbsDown, Copy, Check, Brain, Zap, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { StreamingMessage } from './StreamingMessage';
import tivoLogo from '@/assets/tivo-logo.png';

interface PlanMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface PlanChatProps {
  messages: PlanMessage[];
  isLoading: boolean;
}

function MessageActions({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<'like' | 'dislike' | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={() => setLiked(liked === 'like' ? null : 'like')}
        className={cn(
          'h-7 w-7 rounded-lg flex items-center justify-center transition-colors',
          liked === 'like' ? 'bg-success/15 text-success' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
        )}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setLiked(liked === 'dislike' ? null : 'dislike')}
        className={cn(
          'h-7 w-7 rounded-lg flex items-center justify-center transition-colors',
          liked === 'dislike' ? 'bg-destructive/15 text-destructive' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
        )}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={handleCopy}
        className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export function PlanChat({ messages, isLoading }: PlanChatProps) {
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
      <AnimatePresence mode="popLayout">
        {messages.map((msg, idx) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
              'group',
              msg.role === 'user' ? 'flex justify-end' : ''
            )}
          >
            {msg.role === 'user' ? (
              /* User message — compact bubble */
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-3 text-sm">
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ) : (
              /* AI response — full-width typography, no bubble */
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <img src={tivoLogo} alt="TIVO" className="w-4 h-4" />
                  <span className="text-[11px] font-medium text-muted-foreground">TIVO AI</span>
                  <span className="text-[10px] text-muted-foreground/50">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <StreamingMessage
                  content={msg.content}
                  isLatest={idx === messages.filter(m => m.role === 'assistant').length - 1 && msg.role === 'assistant'}
                />
                <MessageActions content={msg.content} />
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <img src={tivoLogo} alt="TIVO" className="w-4 h-4" />
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
          {/* Think-Act-Review Steps */}
          <div className="flex items-center gap-3 ml-6">
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex items-center gap-1 text-[10px] text-primary"
            >
              <Brain className="h-3 w-3" /> Think
            </motion.div>
            <motion.div
              animate={{ opacity: [0.2, 0.8, 0.2] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground"
            >
              <Zap className="h-3 w-3" /> Act
            </motion.div>
            <motion.div
              animate={{ opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground"
            >
              <CheckCircle2 className="h-3 w-3" /> Review
            </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
