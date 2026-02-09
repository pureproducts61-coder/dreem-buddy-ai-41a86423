import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Bot, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChatMessage } from './ChatMessage';
import { cn } from '@/lib/utils';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatPanelProps {
  projectId: string;
}

// Mock AI responses for demo
const mockResponses = [
  "আমি আপনার অনুরোধ বুঝতে পেরেছি। চলুন এটি তৈরি করি!\n\n```tsx\nconst Button = () => {\n  return <button>Click me</button>;\n};\n```\n\nএই কম্পোনেন্টটি আপনার প্রজেক্টে যোগ করা হয়েছে।",
  "অবশ্যই! এখানে আপনার জন্য একটি responsive navbar তৈরি করছি...\n\n```tsx\nconst Navbar = () => {\n  return (\n    <nav className=\"flex items-center justify-between p-4\">\n      <Logo />\n      <NavLinks />\n    </nav>\n  );\n};\n```",
  "দারুণ আইডিয়া! আমি এই ফিচারটি implement করছি। আপনি Preview ট্যাবে পরিবর্তনগুলো দেখতে পারবেন।",
];

export function ChatPanel({ projectId }: ChatPanelProps) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = localStorage.getItem(`chat-${projectId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
      } catch {
        return [];
      }
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    localStorage.setItem(`chat-${projectId}`, JSON.stringify(messages));
  }, [messages, projectId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate AI response delay
    await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000));

    const aiResponse: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: mockResponses[Math.floor(Math.random() * mockResponses.length)],
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, aiResponse]);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Chat Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">Dreem AI</h3>
          <p className="text-xs text-muted-foreground">{t('workspace.aiHelper')}</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Bot className="h-8 w-8" />
            </div>
            <h3 className="mb-2 font-semibold">{t('workspace.welcomeChat')}</h3>
            <p className="max-w-[280px] text-sm text-muted-foreground">
              {t('workspace.welcomeChatDesc')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    {t('workspace.thinking')}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('workspace.typeMessage')}
            className="min-h-[80px] resize-none pr-12"
            disabled={isLoading}
          />
          <Button
            size="icon"
            className="absolute bottom-2 right-2 h-8 w-8"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground text-center">
          {t('workspace.chatHint')}
        </p>
      </div>
    </div>
  );
}
