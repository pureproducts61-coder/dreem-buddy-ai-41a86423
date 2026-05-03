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
    <div className="relative group/code my-4 rounded-xl overflow-hidden border border-border/30">
      <div className="flex items-center justify-between px-4 py-2 bg-secondary/60 text-xs text-muted-foreground font-mono">
        <span>{language || 'code'}</span>
        <button onClick={handleCopy} className="opacity-0 group-hover/code:opacity-100 transition-opacity flex items-center gap-1.5 hover:text-foreground">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language || 'text'}
        PreTag="div"
        customStyle={{ margin: 0, borderRadius: 0, fontSize: '13px', padding: '16px', background: 'hsl(var(--secondary) / 0.3)' }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

export function StreamingMessage({ content, isLatest }: StreamingMessageProps) {
  // Render the streamed text as it arrives — no extra typewriter
  // (the edge function already streams token-by-token, so this gives
  // a smooth, append-only flow instead of the jumpy re-type effect).
  const text = content;
  const showCursor = isLatest && content.length > 0;

  return (
    <div className="text-[17px] leading-[1.8] text-foreground prose prose-lg dark:prose-invert max-w-none prose-headings:text-foreground prose-headings:font-display prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:text-foreground prose-p:mb-3 prose-strong:text-foreground prose-strong:font-semibold prose-code:text-primary prose-code:bg-secondary/60 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[15px] prose-code:font-medium prose-code:before:content-none prose-code:after:content-none prose-a:text-primary prose-a:underline prose-blockquote:border-primary/40 prose-blockquote:text-muted-foreground prose-blockquote:italic prose-li:text-foreground prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
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
          className="inline-block w-[3px] h-[18px] bg-primary ml-1 align-middle rounded-sm"
        />
      )}
    </div>
  );
}
