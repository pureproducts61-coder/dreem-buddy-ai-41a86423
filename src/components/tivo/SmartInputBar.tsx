import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Mic, MicOff, Plus, X, Hammer, Zap, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  build: { icon: Hammer, label: 'Build' },
  automation: { icon: Zap, label: 'Auto' },
  plan: { icon: MessageSquare, label: 'Plan' },
};

export function SmartInputBar({ mode, onModeChange, onSendMessage, isLoading, className }: SmartInputBarProps) {
  const { t } = useLanguage();
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [voiceWords, setVoiceWords] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-shrink font size based on input length
  const fontSize = input.length > 200 ? '11px' : input.length > 100 ? '12px' : '14px';

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim(), attachedFiles.length > 0 ? attachedFiles : undefined);
    setInput('');
    setAttachedFiles([]);
    setVoiceWords([]);
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
      const results = Array.from(event.results);
      const transcript = results.map((r: any) => r[0].transcript).join(' ');
      const words = transcript.split(' ').filter(Boolean);
      setVoiceWords(words);
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

  return (
    <motion.div
      className={cn('floating-bar p-3 mx-3 mb-3', className)}
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Mode Toggle */}
      <div className="flex items-center gap-1 mb-2.5">
        {(['build', 'automation', 'plan'] as TivoMode[]).map((m) => {
          const { icon: Icon, label } = modeConfig[m];
          const isActive = mode === m;
          return (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(`mode.${m}`)}
            </button>
          );
        })}
      </div>

      {/* Attached Files */}
      <AnimatePresence>
        {attachedFiles.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap gap-1.5 mb-2 overflow-hidden"
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

      {/* Voice Words Animation */}
      <AnimatePresence>
        {isListening && voiceWords.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap gap-1 mb-2">
            {voiceWords.map((word, i) => (
              <motion.span
                key={`${word}-${i}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="text-sm text-primary font-medium"
              >
                {word}
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Row */}
      <div className="flex items-end gap-2">
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-9 w-9 rounded-xl shrink-0 transition-colors',
              isListening && 'bg-destructive/10 text-destructive'
            )}
            onClick={toggleVoice}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl shrink-0" onClick={() => fileInputRef.current?.click()}>
            <Plus className="h-4 w-4" />
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
        </div>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('home.inputPlaceholder')}
          rows={1}
          style={{ fontSize }}
          className="flex-1 min-h-[44px] max-h-[120px] resize-none bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground/50 py-2.5 transition-[font-size] duration-200"
          disabled={isLoading}
        />

        <Button
          size="icon"
          className={cn(
            'h-9 w-9 rounded-xl shrink-0 transition-all',
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
            className="flex items-center justify-center gap-2 pt-2"
          >
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-primary font-medium">{t('home.listening')}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
