import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  className?: string;
}

export function SuggestionChips({ suggestions, onSelect, className }: SuggestionChipsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('relative px-2 py-3', className)}
    >
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
        {suggestions.map((suggestion, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={() => onSelect(suggestion)}
            className={cn(
              'snap-start shrink-0 w-[78%] sm:w-[280px] max-w-[320px]',
              'group relative text-left rounded-2xl p-3.5',
              'bg-gradient-to-br from-card via-card to-secondary/30',
              'border border-border/40 hover:border-primary/40',
              'shadow-sm hover:shadow-lg hover:shadow-primary/10',
              'transition-all duration-200 hover:-translate-y-0.5'
            )}
          >
            <div className="flex items-start gap-2">
              <div className="h-7 w-7 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-[13px] leading-snug text-foreground line-clamp-3">
                {suggestion}
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
