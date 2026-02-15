import { useState, useCallback, useRef, useEffect } from 'react';
import { SmartInputBar, TivoMode } from '@/components/tivo/SmartInputBar';
import { BuildWorkspace } from '@/components/tivo/BuildWorkspace';
import { AutomationWorkspace } from '@/components/tivo/AutomationWorkspace';
import { PlanChat } from '@/components/tivo/PlanChat';
import { ControlPanel } from '@/components/tivo/ControlPanel';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const mockResponses: Record<TivoMode, string[]> = {
  build: [
    'প্রজেক্ট স্ট্রাকচার তৈরি করছি... React কম্পোনেন্ট জেনারেট হচ্ছে।\n\nআপনার Landing Page প্রস্তুত। Hero section, navigation, এবং footer যোগ করা হয়েছে।',
    'কোড জেনারেশন সম্পন্ন! ফাইল স্ট্রাকচার:\n\n```\nsrc/\n├── components/\n│   ├── Hero.tsx\n│   └── Footer.tsx\n└── pages/\n    └── index.tsx\n```\n\nPreview-তে দেখুন।',
  ],
  automation: [
    'অটোমেশন প্রসেস শুরু হচ্ছে... টেস্ট রান করছি।',
    'CI/CD পাইপলাইন কনফিগার করা হয়েছে। ✅',
  ],
  plan: [
    'আপনার প্রজেক্টের জন্য আমি নিচের প্ল্যান প্রস্তাব করছি:\n\n**Phase 1:** ফ্রন্টএন্ড — React + Tailwind\n**Phase 2:** ব্যাকএন্ড — FastAPI\n**Phase 3:** ডাটাবেজ — PostgreSQL\n\nআপনি কি এই প্ল্যানে সম্মত?',
    'চলুন বিস্তারিত আলোচনা করি। আপনার টার্গেট অডিয়েন্স কে? কোন ধরনের ফিচার প্রয়োজন সেটা বলুন।',
    'বুঝেছি। আমি মনে করি Build মোডে গিয়ে সরাসরি শুরু করা যেতে পারে। অনুমতি দিলে মোড পরিবর্তন করে দিই।',
  ],
};

export function ChatTab() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<TivoMode>('plan');
  const [messages, setMessages] = useState<Record<TivoMode, Message[]>>({
    build: [],
    automation: [],
    plan: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSendMessage = useCallback(async (content: string, files?: File[]) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: files ? `${content}\n\n📎 ${files.map(f => f.name).join(', ')}` : content,
      timestamp: new Date(),
    };

    setMessages(prev => ({
      ...prev,
      [mode]: [...prev[mode], userMsg],
    }));
    setIsLoading(true);

    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));

    const responses = mockResponses[mode];
    const aiMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: responses[Math.floor(Math.random() * responses.length)],
      timestamp: new Date(),
    };

    setMessages(prev => ({
      ...prev,
      [mode]: [...prev[mode], aiMsg],
    }));
    setIsLoading(false);
  }, [mode]);

  const currentMessages = messages[mode];
  const isCleanSlate = mode === 'plan' && currentMessages.length === 0 && !isLoading;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Dynamic Workspace */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <AnimatePresence mode="wait">
          {mode === 'build' && (
            <motion.div key="build" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col min-h-0">
              <BuildWorkspace messages={currentMessages} isLoading={isLoading} onOpenMenu={() => setMenuOpen(true)} />
            </motion.div>
          )}
          {mode === 'automation' && (
            <motion.div key="automation" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col min-h-0">
              <AutomationWorkspace isLoading={isLoading} />
            </motion.div>
          )}
          {mode === 'plan' && (
            <motion.div key="plan" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col min-h-0">
              {isCleanSlate ? (
                <div className="flex-1 flex flex-col items-center justify-center px-8">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-8"
                  >
                    <div className="text-5xl mb-4">❤️</div>
                    <h1 className="text-3xl sm:text-4xl font-display font-bold mb-2 tracking-tight gradient-text-brand">
                      TIVO AI
                    </h1>
                    <p className="text-muted-foreground text-sm">
                      {t('home.greeting')}
                    </p>
                  </motion.div>
                </div>
              ) : (
                <PlanChat messages={currentMessages} isLoading={isLoading} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Smart Input Bar */}
      <SmartInputBar
        mode={mode}
        onModeChange={setMode}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />

      {/* Control Panel */}
      <ControlPanel open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
