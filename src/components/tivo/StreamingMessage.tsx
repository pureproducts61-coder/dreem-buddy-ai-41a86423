import { useStreamingText } from '@/hooks/useStreamingText';
import { motion } from 'framer-motion';

interface StreamingMessageProps {
  content: string;
  isLatest: boolean;
}

export function StreamingMessage({ content, isLatest }: StreamingMessageProps) {
  const { displayedText, isStreaming } = useStreamingText(content, 20);

  // Only stream the latest AI message
  const text = isLatest ? displayedText : content;
  const showCursor = isLatest && isStreaming;

  return (
    <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
      {text}
      {showCursor && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle"
        />
      )}
    </div>
  );
}
