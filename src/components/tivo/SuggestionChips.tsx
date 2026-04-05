import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  className?: string;
}

export function SuggestionChips({ suggestions, onSelect, className }: SuggestionChipsProps) {
  if (suggestions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-wrap gap-2 px-4 py-3', className)}
    >
      {suggestions.map((suggestion, i) => (
        <motion.button
          key={i}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.08 }}
          onClick={() => onSelect(suggestion)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-secondary/60 hover:bg-secondary text-foreground border border-border/30 hover:border-primary/30 transition-all hover:shadow-sm"
        >
          <Sparkles className="h-3 w-3 text-primary shrink-0" />
          <span className="text-left">{suggestion}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}
