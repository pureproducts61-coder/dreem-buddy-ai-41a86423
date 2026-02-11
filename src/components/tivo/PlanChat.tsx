import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

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

export function PlanChat({ messages, isLoading }: PlanChatProps) {
  const { t } = useLanguage();

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.length === 0 && !isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-full text-center px-8"
        >
          <p className="text-2xl font-semibold mb-2">{t('home.greeting')}</p>
          <p className="text-sm text-muted-foreground">{t('home.inputPlaceholder')}</p>
        </motion.div>
      )}

      <AnimatePresence mode="popLayout">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
              msg.role === 'user'
                ? 'ml-auto bg-primary text-primary-foreground rounded-br-md'
                : 'mr-auto glass-panel rounded-bl-md'
            )}
          >
            <p className="whitespace-pre-wrap">{msg.content}</p>
            <span className="block text-[10px] mt-1.5 opacity-50">
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>

      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mr-auto flex items-center gap-2 text-sm text-muted-foreground px-2"
        >
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          {t('warroom.thinking')}
        </motion.div>
      )}
    </div>
  );
}
