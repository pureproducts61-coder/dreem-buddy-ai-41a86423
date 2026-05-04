import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Mic, MicOff, Paperclip, X, Hammer, Zap, MessageSquare, Coins, Sparkles, CornerDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useCredits } from '@/hooks/useCredits';
import { CREDIT_COST_PER_MESSAGE } from '@/services/creditsService';

export type TivoMode = 'build' | 'automation' | 'plan';

interface SmartInputBarProps {
  mode: TivoMode;
  onModeChange: (mode: TivoMode) => void;
  onSendMessage: (content: string, files?: File[]) => void;
  isLoading: boolean;
  className?: string;
  externalDraft?: string;
  onRequestMoreCredits?: () => void;
}

const modeConfig = {
  build: { icon: Hammer, label: 'Build', color: 'text-primary' },
  automation: { icon: Zap, label: 'Auto', color: 'text-amber-500' },
  plan: { icon: MessageSquare, label: 'Plan', color: 'text-emerald-500' },
};

export function SmartInputBar({ mode, onModeChange, onSendMessage, isLoading, className, externalDraft, onRequestMoreCredits }: SmartInputBarProps) {
  const { t } = useLanguage();
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [modeOpen, setModeOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef('');
  const { credits, isAdmin } = useCredits();

  const ActiveIcon = modeConfig[mode].icon;
  const isAdminUser = isAdmin;
  const outOfCredits = !isAdminUser && credits <= 0;

  useEffect(() => {
    const check = () => setIsMobile(window.matchMedia('(max-width: 640px)').matches);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Allow parent to inject a draft (e.g. from suggestion chip click)
  useEffect(() => {
    if (externalDraft !== undefined) {
      setInput(externalDraft);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [externalDraft]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    if (outOfCredits) {
      onRequestMoreCredits?.();
      return;
    }
    onSendMessage(input.trim(), attachedFiles.length > 0 ? attachedFiles : undefined);
    setInput('');
    setAttachedFiles([]);
  }, [input, isLoading, onSendMessage, attachedFiles, outOfCredits, onRequestMoreCredits]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // On mobile: Enter = newline (use Send button instead).
    // On desktop: Enter = send, Shift/Ctrl+Enter = newline.
    if (e.key === 'Enter') {
      if (isMobile) return; // allow newline
      if (e.shiftKey || e.ctrlKey || e.metaKey) return; // newline
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Allow native paste; also intercept image files from clipboard
    const items = e.clipboardData?.items;
    if (!items) return;
    const imgs: File[] = [];
    for (const it of Array.from(items)) {
      if (it.kind === 'file') {
        const f = it.getAsFile();
        if (f) imgs.push(f);
      }
    }
    if (imgs.length > 0) {
      e.preventDefault();
      setAttachedFiles(prev => [...prev, ...imgs]);
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
    if (!SpeechRecognition) {
      alert('এই ব্রাউজারে Voice সাপোর্ট নেই। Chrome/Edge ব্যবহার করুন।');
      return;
    }
    baseInputRef.current = input ? input + ' ' : '';
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language?.startsWith('bn') ? 'bn-BD' : 'en-US';
    recognitionRef.current = recognition;
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(baseInputRef.current + transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  }, [isListening, input]);

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
      className={cn('floating-bar input-thread mx-3 mb-3 flex flex-col', className)}
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
        onPaste={handlePaste}
        placeholder={outOfCredits ? 'Out of credits — request more from admin' : t('home.inputPlaceholder')}
        rows={1}
        className="w-full min-h-[52px] max-h-[180px] resize-none bg-transparent border-0 outline-none text-foreground placeholder:text-muted-foreground/50 px-4 pt-4 pb-1 text-base leading-relaxed"
        disabled={isLoading}
      />

      {/* Bottom action bar */}
      <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
        <div className="flex items-center gap-1.5">
          {/* Mode Popover */}
          <Popover open={modeOpen} onOpenChange={setModeOpen}>
            <PopoverTrigger asChild>
              <button className={cn('pill-btn relative', modeConfig[mode].color)} title={`Mode: ${mode}`}>
                <ActiveIcon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                <Sparkles className="h-2.5 w-2.5 absolute -top-0.5 -right-0.5 text-primary opacity-80" />
              </button>
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
          <button
            className={cn('pill-btn', isListening && 'bg-destructive/15 text-destructive border-destructive/40 shadow-[0_0_18px_hsl(var(--destructive)/0.25)]')}
            onClick={toggleVoice}
            title="Voice input"
          >
            {isListening ? <MicOff className="h-[18px] w-[18px]" strokeWidth={2.2} /> : <Mic className="h-[18px] w-[18px]" strokeWidth={2.2} />}
          </button>

          {/* Attach */}
          <button className="pill-btn" onClick={() => fileInputRef.current?.click()} title="Attach file or image">
            <Paperclip className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,text/*,.json,.md,.txt,.csv,.pdf,.tsx,.ts,.jsx,.js,.html,.css,.py,.yml,.yaml,.xml,.sql,.sh,.env,.toml,.cfg,.ini"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Newline helper (mobile-only visual hint) */}
          {isMobile && (
            <button
              className="pill-btn"
              onClick={() => setInput(v => v + '\n')}
              title="নতুন লাইন"
            >
              <CornerDownLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Credits badge */}
          {!isAdminUser && (
            <button
              onClick={() => outOfCredits && onRequestMoreCredits?.()}
              className={cn(
                'flex items-center gap-1 px-2.5 h-7 rounded-full text-[11px] font-mono transition-colors',
                outOfCredits
                  ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
                  : credits < 10
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'bg-secondary/40 text-muted-foreground'
              )}
              title={`${credits} credits remaining (${CREDIT_COST_PER_MESSAGE}/message)`}
            >
              <Coins className="h-3 w-3" />
              {credits}
            </button>
          )}

          {/* Send */}
          <Button
            size="icon"
            className={cn(
              'h-11 w-11 rounded-full transition-all shadow-md bg-gradient-to-br from-primary to-primary/70 hover:scale-[1.04] active:scale-95',
              input.trim() && !outOfCredits ? 'glow-primary-strong' : ''
            )}
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-[18px] w-[18px]" />
          </Button>
        </div>
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
