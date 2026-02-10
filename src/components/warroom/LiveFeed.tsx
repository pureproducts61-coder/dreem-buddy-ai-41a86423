import { useState, useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';

interface LogEntry {
  id: string;
  text: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'action';
}

interface LiveFeedProps {
  logs: LogEntry[];
}

// Typing animation component
function TypingText({ text, speed = 30 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        setDone(true);
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span>
      {displayed}
      {!done && <span className="typing-cursor" />}
    </span>
  );
}

const mockLogs: LogEntry[] = [
  { id: '1', text: 'সিস্টেম ইনিশিয়ালাইজ হচ্ছে... সকল মডিউল সক্রিয়।', timestamp: new Date(), type: 'info' },
  { id: '2', text: 'ব্যাকএন্ড সংযোগ স্থাপিত। HF Spaces রেসপন্স করছে।', timestamp: new Date(), type: 'success' },
  { id: '3', text: 'এআই এজেন্ট প্রস্তুত। কমান্ডের অপেক্ষায়...', timestamp: new Date(), type: 'info' },
  { id: '4', text: 'প্রজেক্ট স্ট্রাকচার বিশ্লেষণ চলছে...', timestamp: new Date(), type: 'action' },
  { id: '5', text: 'কোড জেনারেশন শুরু হয়েছে। React কম্পোনেন্ট তৈরি হচ্ছে।', timestamp: new Date(), type: 'action' },
  { id: '6', text: '✓ App.tsx সফলভাবে তৈরি হয়েছে।', timestamp: new Date(), type: 'success' },
  { id: '7', text: 'টেস্টিং মডিউল চালু হচ্ছে...', timestamp: new Date(), type: 'info' },
];

export function LiveFeed({ logs: externalLogs }: LiveFeedProps) {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<LogEntry[]>(mockLogs);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (externalLogs.length > 0) {
      setLogs(externalLogs);
    }
  }, [externalLogs]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const typeColors = {
    info: 'text-muted-foreground',
    success: 'text-neon-green',
    warning: 'text-warning',
    action: 'text-primary',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <Activity className="h-4 w-4 text-primary animate-pulse-glow" />
        <span className="text-xs font-display uppercase tracking-wider text-primary">
          {t('warroom.liveFeed')}
        </span>
        <span className="ml-auto flex h-2 w-2 rounded-full bg-neon-green animate-pulse" />
      </div>

      {/* Log Entries */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono text-xs">
        <AnimatePresence>
          {logs.map((log, index) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.15, duration: 0.3 }}
              className={`flex gap-2 ${typeColors[log.type]}`}
            >
              <span className="text-muted-foreground/40 shrink-0">
                {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="text-primary/40 shrink-0">▸</span>
              {index === logs.length - 1 ? (
                <TypingText text={log.text} speed={25} />
              ) : (
                <span>{log.text}</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
