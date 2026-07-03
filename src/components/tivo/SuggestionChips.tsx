import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  onSelectMany?: (suggestions: string[]) => void;
  className?: string;
}

export function SuggestionChips({ suggestions, onSelect, onSelectMany, className }: SuggestionChipsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const updateArrows = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [suggestions]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(220, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  if (suggestions.length === 0) return null;

  const toggle = (i: number) => {
    setPicked(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const sendPicked = () => {
    const items = Array.from(picked).sort().map(i => suggestions[i]).filter(Boolean);
    if (items.length === 0) return;
    if (items.length === 1 || !onSelectMany) onSelect(items.join('\n\n— '));
    else onSelectMany(items);
    setPicked(new Set());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('relative px-2 py-3', className)}
    >
      <AnimatePresence>
        {picked.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center justify-between px-3 pb-2"
          >
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              {picked.size} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPicked(new Set())}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >Clear</button>
              <button
                onClick={sendPicked}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-colors"
              >
                <Send className="h-3 w-3" />
                Use {picked.size}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {canLeft && (
        <button
          onClick={() => scrollBy(-1)}
          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full bg-background/90 border border-border/40 backdrop-blur-md shadow-md hover:bg-secondary"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {canRight && (
        <button
          onClick={() => scrollBy(1)}
          className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full bg-background/90 border border-border/40 backdrop-blur-md shadow-md hover:bg-secondary"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      <div
        ref={scrollerRef}
        className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory scroll-smooth px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {suggestions.map((suggestion, i) => {
          const isPicked = picked.has(i);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                'snap-start shrink-0 w-[78%] sm:w-[280px] max-w-[320px]',
                'group relative rounded-2xl overflow-hidden',
                'border transition-all duration-200',
                isPicked
                  ? 'border-primary/70 bg-primary/10 shadow-lg shadow-primary/15'
                  : 'border-border/40 bg-card/80 hover:border-primary/40 hover:-translate-y-0.5'
              )}
            >
              <button
                onClick={() => toggle(i)}
                onDoubleClick={() => onSelect(suggestion)}
                className="w-full text-left p-3.5 pr-9"
                title="Click to select · Double-click to send"
              >
                <p className="text-[13px] leading-snug text-foreground line-clamp-4 font-medium">
                  {suggestion}
                </p>
              </button>
              <button
                onClick={() => toggle(i)}
                aria-label={isPicked ? 'Unselect' : 'Select'}
                className={cn(
                  'absolute top-2.5 right-2.5 h-5 w-5 rounded-md border flex items-center justify-center transition-all',
                  isPicked
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-background/80 border-border/60 text-transparent group-hover:text-muted-foreground'
                )}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </button>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
