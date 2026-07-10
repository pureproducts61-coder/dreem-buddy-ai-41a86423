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

      {/* Single-line, horizontally-scrollable pill chips. Click sends the full
          suggestion to the input bar (via onSelect). Long-press / hover reveals
          the checkmark for multi-select mode. */}
      <div
        ref={scrollerRef}
        className="flex gap-2 overflow-x-auto scroll-smooth px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {suggestions.map((suggestion, i) => {
          const isPicked = picked.has(i);
          return (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => onSelect(suggestion)}
              onContextMenu={(e) => { e.preventDefault(); toggle(i); }}
              title={suggestion}
              className={cn(
                'group shrink-0 h-8 max-w-[260px] px-3 rounded-full',
                'inline-flex items-center gap-1.5',
                'text-xs font-medium whitespace-nowrap overflow-hidden text-ellipsis',
                'border transition-all',
                isPicked
                  ? 'border-primary/70 bg-primary/15 text-primary'
                  : 'border-border/50 bg-card/70 text-foreground hover:border-primary/40 hover:bg-primary/5'
              )}
            >
              {isPicked && <Check className="h-3 w-3 shrink-0" strokeWidth={3} />}
              <span className="truncate">{suggestion}</span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
