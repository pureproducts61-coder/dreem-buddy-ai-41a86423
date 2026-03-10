import { useState } from 'react';
import { Archive, MessageCircle, Eye } from 'lucide-react';
import { HeaderMenu } from '@/components/tivo/HeaderMenu';
import { ChatTab } from '@/components/tivo/ChatTab';
import { ProjectVault } from '@/components/tivo/ProjectVault';
import { PreviewTab } from '@/components/tivo/PreviewTab';
import { ControlPanel } from '@/components/tivo/ControlPanel';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type BottomTab = 'vault' | 'chat' | 'preview';

const tabConfig = {
  vault: { icon: Archive, label: 'Vault' },
  chat: { icon: MessageCircle, label: 'Chat' },
  preview: { icon: Eye, label: 'Preview' },
};

const Home = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<BottomTab>('chat');
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

  const handleOpenSession = (sessionId: string) => {
    setOpenSessionId(sessionId);
    setActiveTab('chat');
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <HeaderMenu onSettingsClick={() => setMenuOpen(true)} />

      <div className="flex-1 flex flex-col min-h-0">
        <AnimatePresence mode="wait">
          {activeTab === 'vault' && (
            <motion.div key="vault" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col min-h-0">
              <ProjectVault onOpenSession={handleOpenSession} />
            </motion.div>
          )}
          {activeTab === 'chat' && (
            <motion.div key={`chat-${openSessionId || 'default'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col min-h-0">
              <ChatTab initialSessionId={openSessionId} />
            </motion.div>
          )}
          {activeTab === 'preview' && (
            <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col min-h-0">
              <PreviewTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="flex items-center justify-around border-t border-border/20 bg-card/80 backdrop-blur-xl px-2 pb-[env(safe-area-inset-bottom)]">
        {(Object.keys(tabConfig) as BottomTab[]).map((tab) => {
          const { icon: Icon, label } = tabConfig[tab];
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2.5 px-4 rounded-xl transition-all relative',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute -top-px left-2 right-2 h-0.5 rounded-full bg-primary tab-active-indicator"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className={cn('h-5 w-5 transition-transform', isActive && 'scale-110')} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </nav>

      <ControlPanel open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
};

export default Home;
