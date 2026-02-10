import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Mic, MicOff, Paperclip, Calendar, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface WarRoomChatProps {
  projectId: string;
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
}

export function WarRoomChat({ projectId, messages, onSendMessage, isLoading }: WarRoomChatProps) {
  const { t } = useLanguage();
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleVoice = () => {
    setIsListening(!isListening);
    // Mock voice - in production connect to Web Speech API
  };

  return (
    <div className="flex flex-col border-t border-border/50 bg-card/50">
      {/* Input Area */}
      <div className="p-3">
        <div className="relative flex items-end gap-2">
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8 shrink-0', isListening && 'text-destructive bg-destructive/10')}
              onClick={toggleVoice}
              title={t('warroom.voiceInput')}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title={t('warroom.attachFile')}>
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title={t('warroom.schedule')}>
              <Calendar className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('warroom.chatPlaceholder')}
            className="min-h-[44px] max-h-[120px] resize-none bg-secondary/50 border-border/50 font-mono text-sm"
            disabled={isLoading}
          />
          <Button
            size="icon"
            className="h-8 w-8 shrink-0 glow-cyan"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
