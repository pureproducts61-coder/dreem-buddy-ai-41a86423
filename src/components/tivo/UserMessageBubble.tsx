import { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props { content: string }

const FOLD_THRESHOLD = 320;

export function UserMessageBubble({ content }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isLong = content.length > FOLD_THRESHOLD;
  const display = !isLong || expanded ? content : content.slice(0, FOLD_THRESHOLD) + '…';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[85%] rounded-3xl bg-secondary/70 border border-border/40 text-foreground px-4 py-3 text-[15px] leading-relaxed shadow-sm group"
    >
      <p className="whitespace-pre-wrap break-words">{display}</p>
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30 opacity-60 group-hover:opacity-100 transition-opacity">
        {isLong && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground ml-auto"
        >
          {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </motion.div>
  );
}