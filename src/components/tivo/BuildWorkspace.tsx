import { useState } from 'react';
import { Eye, MoreVertical, ExternalLink, Loader2, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ControlPanel } from './ControlPanel';

interface BuildMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface BuildWorkspaceProps {
  messages: BuildMessage[];
  isLoading: boolean;
  onOpenMenu: () => void;
}

export function BuildWorkspace({ messages, isLoading, onOpenMenu }: BuildWorkspaceProps) {
  const { t } = useLanguage();
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
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
            className="mr-auto glass-panel rounded-2xl rounded-bl-md px-4 py-3"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {t('build.thinking')}
            </div>
            <div className="mt-2 h-1 w-32 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full bg-primary/50 rounded-full"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                style={{ width: '50%' }}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
          className="gap-1.5 text-xs"
        >
          <Eye className="h-3.5 w-3.5" />
          {t('build.preview')}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onOpenMenu}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>

      {/* Preview Panel (slides up) */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: '50%' }}
            exit={{ height: 0 }}
            className="border-t border-border/30 overflow-hidden bg-card"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Code className="h-3 w-3" />
                {t('build.preview')}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <ExternalLink className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowPreview(false)}>
                  ×
                </Button>
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
