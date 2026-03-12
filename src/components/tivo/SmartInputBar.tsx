import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Mic, MicOff, Plus, X, Hammer, Zap, MessageSquare, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export type TivoMode = 'build' | 'automation' | 'plan';

interface SmartInputBarProps {
  mode: TivoMode;
  onModeChange: (mode: TivoMode) => void;
  onSendMessage: (content: string, files?: File[]) => void;
  isLoading: boolean;
  className?: string;
}

const modeConfig = {
  build: { icon: Hammer, label: 'Build', color: 'text-primary' },
  automation: { icon: Zap, label: 'Auto', color: 'text-amber-500' },
  plan: { icon: MessageSquare, label: 'Plan', color: 'text-emerald-500' },
};

export function SmartInputBar({ mode, onModeChange, onSendMessage, isLoading, className }: SmartInputBarProps) {
  const { t } = useLanguage();
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [modeOpen, setModeOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const ActiveIcon = modeConfig[mode].icon;

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim(), attachedFiles.length > 0 ? attachedFiles : undefined);
    setInput('');
    setAttachedFiles([]);
  }, [input, isLoading, onSendMessage, attachedFiles]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      setAttachedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  }, []);

  const toggleVoice = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'bn-BD';
    recognitionRef.current = recognition;
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join(' ');
      setInput(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  }, [input]);

  return (
    <motion.div
      className={cn('floating-bar mx-3 mb-3 flex flex-col', className)}
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Attached Files */}
      <AnimatePresence>
        {attachedFiles.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap gap-1.5 px-3 pt-2 overflow-hidden"
          >
            {attachedFiles.map((file, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-[11px] font-mono text-secondary-foreground"
              >
                {file.name.length > 20 ? file.name.slice(0, 18) + '...' : file.name}
                <button onClick={() => removeFile(i)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Textarea — starts from top-left, grows upward */}
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('home.inputPlaceholder')}
        rows={1}
        className="w-full min-h-[44px] max-h-[160px] resize-none bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground/50 px-3 pt-3 pb-1 text-sm leading-relaxed"
        disabled={isLoading}
      />

      {/* Bottom action bar */}
      <div className="flex items-center justify-between px-2 pb-2 pt-1">
        <div className="flex items-center gap-0.5">
          {/* Mode Popover */}
          <Popover open={modeOpen} onOpenChange={setModeOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8 rounded-xl', modeConfig[mode].color)}
              >
                <ActiveIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1.5" side="top" align="start">
              {(['build', 'automation', 'plan'] as TivoMode[]).map((m) => {
                const { icon: Icon, label, color } = modeConfig[m];
                const isActive = mode === m;
                return (
                  <button
                    key={m}
                    onClick={() => { onModeChange(m); setModeOpen(false); }}
                    className={cn(
                      'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs font-medium transition-all',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    )}
                  >
                    <Icon className={cn('h-4 w-4', isActive && color)} />
                    {t(`mode.${m}`)}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>

          {/* Voice */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8 rounded-xl transition-colors',
              isListening && 'bg-destructive/10 text-destructive'
            )}
            onClick={toggleVoice}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>

          {/* Attach */}
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => fileInputRef.current?.click()}>
            <Plus className="h-4 w-4" />
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
        </div>

        {/* Send */}
        <Button
          size="icon"
          className={cn(
            'h-8 w-8 rounded-xl transition-all',
            input.trim() ? 'glow-primary' : ''
          )}
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Listening indicator */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center justify-center gap-2 pb-2"
          >
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-primary font-medium">{t('home.listening')}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
