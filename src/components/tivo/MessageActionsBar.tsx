import { useState } from 'react';
import { Copy, Check, ThumbsUp, ThumbsDown, MoreVertical } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface MessageActionsBarProps {
  messageId?: string;
  content: string;
  creditsUsed?: number;
  executionTimeMs?: number;
  initialReaction?: 'like' | 'dislike' | 'none';
}

/**
 * Actions row shown under every AI message:
 *  - 👍 like / 👎 dislike  (persisted to chat_messages.reaction if messageId given)
 *  - 📋 copy raw markdown
 *  - ⋮ three-dot popover: 🪙 credits used, ⏳ execution time
 */
export function MessageActionsBar({
  messageId,
  content,
  creditsUsed = 0,
  executionTimeMs = 0,
  initialReaction = 'none',
}: MessageActionsBarProps) {
  const [copied, setCopied] = useState(false);
  const [reaction, setReaction] = useState<'like' | 'dislike' | 'none'>(initialReaction);

  const setReactionRemote = async (next: 'like' | 'dislike' | 'none') => {
    setReaction(next);
    if (!messageId) return;
    try {
      await supabase.from('chat_messages').update({ reaction: next }).eq('id', messageId);
    } catch {
      /* offline / local-only session — reaction stays in memory */
    }
  };

  const toggle = (kind: 'like' | 'dislike') =>
    setReactionRemote(reaction === kind ? 'none' : kind);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const seconds = executionTimeMs > 0 ? (executionTimeMs / 1000).toFixed(2) : '0.00';

  return (
    <div className="mt-1.5 flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
      <button
        onClick={() => toggle('like')}
        aria-label="Like"
        className={cn(
          'p-1.5 rounded-md hover:bg-muted/60 transition-colors',
          reaction === 'like' && 'text-primary bg-primary/10'
        )}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => toggle('dislike')}
        aria-label="Dislike"
        className={cn(
          'p-1.5 rounded-md hover:bg-muted/60 transition-colors',
          reaction === 'dislike' && 'text-destructive bg-destructive/10'
        )}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={handleCopy}
        aria-label="Copy"
        className="p-1.5 rounded-md hover:bg-muted/60 transition-colors"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <Popover>
        <PopoverTrigger asChild>
          <button
            aria-label="Message details"
            className="p-1.5 rounded-md hover:bg-muted/60 transition-colors"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-56 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">🪙 Credits used</span>
            <span className="font-mono font-semibold text-foreground">{creditsUsed}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground">⏳ Response time</span>
            <span className="font-mono font-semibold text-foreground">{seconds}s</span>
          </div>
          {messageId && (
            <div className="pt-1 border-t border-border/40 text-[10px] font-mono text-muted-foreground truncate">
              id: {messageId.slice(0, 8)}…
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}