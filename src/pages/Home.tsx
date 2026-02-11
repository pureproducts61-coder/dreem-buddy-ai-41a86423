import { useState, useCallback } from 'react';
import { SmartInputBar, TivoMode } from '@/components/tivo/SmartInputBar';
import { BuildWorkspace } from '@/components/tivo/BuildWorkspace';
import { AutomationWorkspace } from '@/components/tivo/AutomationWorkspace';
import { PlanChat } from '@/components/tivo/PlanChat';
import { HeaderMenu } from '@/components/tivo/HeaderMenu';
import { ControlPanel } from '@/components/tivo/ControlPanel';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const mockResponses: Record<TivoMode, string[]> = {
  build: [
    'প্রজেক্ট স্ট্রাকচার তৈরি করছি... React কম্পোনেন্ট জেনারেট হচ্ছে।',
    'কোড জেনারেশন সম্পন্ন! আপনার প্রজেক্ট প্রস্তুত। Preview-তে দেখুন।',
    'Landing page তৈরি হয়ে গেছে। Hero section, features, এবং footer যোগ করা হয়েছে।',
  ],
  automation: [
    'অটোমেশন প্রসেস শুরু হচ্ছে... টেস্ট রান করছি।',
    'CI/CD পাইপলাইন কনফিগার করা হয়েছে।',
  ],
  plan: [
    'আপনার প্রজেক্টের জন্য আমি নিচের প্ল্যান প্রস্তাব করছি:\n\n1. ফ্রন্টএন্ড: React + Tailwind\n2. ব্যাকএন্ড: FastAPI\n3. ডাটাবেজ: PostgreSQL\n\nআপনি কি এই প্ল্যানে সম্মত?',
    'চলুন বিস্তারিত আলোচনা করি। আপনার টার্গেট অডিয়েন্স কে?',
    'বুঝেছি। আমি মনে করি Build মোডে গিয়ে সরাসরি শুরু করা যেতে পারে। অনুমতি দিলে মোড পরিবর্তন করে দিই।',
  ],
};

const Home = () => {
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
    <div className="flex h-[100dvh] flex-col bg-background">
      {/* Header */}
      <HeaderMenu onSettingsClick={() => setMenuOpen(true)} />

      {/* Dynamic Workspace */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <AnimatePresence mode="wait">
          {mode === 'build' && (
            <motion.div key="build" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0">
              <BuildWorkspace messages={currentMessages} isLoading={isLoading} onOpenMenu={() => setMenuOpen(true)} />
            </motion.div>
          )}
          {mode === 'automation' && (
            <motion.div key="automation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0">
              <AutomationWorkspace isLoading={isLoading} />
            </motion.div>
          )}
          {mode === 'plan' && (
            <motion.div key="plan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0">
              {isCleanSlate ? (
                <div className="flex-1 flex flex-col items-center justify-center px-8">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-8"
                  >
                    <h1 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight">
                      <span className="text-primary glow-text-primary">TIVO</span>
                    </h1>
                    <p className="text-muted-foreground text-sm sm:text-base">
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
};

export default Home;
