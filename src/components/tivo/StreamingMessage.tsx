import { useStreamingText } from '@/hooks/useStreamingText';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface StreamingMessageProps {
  content: string;
  isLatest: boolean;
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code my-3 rounded-xl overflow-hidden border border-border/30">
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/50 text-[10px] text-muted-foreground font-mono">
        <span>{language || 'code'}</span>
        <button onClick={handleCopy} className="opacity-0 group-hover/code:opacity-100 transition-opacity flex items-center gap-1 hover:text-foreground">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language || 'text'}
        PreTag="div"
        customStyle={{ margin: 0, borderRadius: 0, fontSize: '12px', padding: '12px 16px', background: 'hsl(var(--secondary) / 0.3)' }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

export function StreamingMessage({ content, isLatest }: StreamingMessageProps) {
  const { displayedText, isStreaming } = useStreamingText(content, 15);
  const text = isLatest ? displayedText : content;
  const showCursor = isLatest && isStreaming;

  return (
    <div className="text-sm leading-relaxed text-foreground prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-code:text-primary prose-code:bg-secondary/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-a:text-primary prose-blockquote:border-primary/30 prose-blockquote:text-muted-foreground prose-li:text-foreground">
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeStr = String(children).replace(/\n$/, '');
            if (match || codeStr.includes('\n')) {
              return <CodeBlock language={match?.[1] || ''}>{codeStr}</CodeBlock>;
            }
            return <code className={className} {...props}>{children}</code>;
          },
        }}
      >
        {text}
      </ReactMarkdown>
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
