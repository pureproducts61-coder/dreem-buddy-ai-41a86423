import { useState, useCallback, useEffect } from 'react';
import tivoLogo from '@/assets/tivo-logo.png';
import { SmartInputBar, TivoMode } from '@/components/tivo/SmartInputBar';
import { BuildWorkspace } from '@/components/tivo/BuildWorkspace';
import { AutomationWorkspace } from '@/components/tivo/AutomationWorkspace';
import { PlanChat } from '@/components/tivo/PlanChat';
import { ControlPanel } from '@/components/tivo/ControlPanel';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { streamChat, hasAnyAIConfig, type ToolEvent } from '@/services/aiChatService';
import { hybridChatPersistence } from '@/services/hybridStorageService';
import { useToast } from '@/hooks/use-toast';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolEvents?: ToolEvent[];
}

interface ChatTabProps {
  initialSessionId?: string | null;
  initialMode?: TivoMode | null;
}

export function ChatTab({ initialSessionId, initialMode }: ChatTabProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [mode, setMode] = useState<TivoMode>(initialMode || (initialSessionId ? 'build' : 'plan'));
  const [messages, setMessages] = useState<Record<TivoMode, Message[]>>({
    build: [],
    automation: [],
    plan: [],
  });
  const [sessionIds, setSessionIds] = useState<Record<TivoMode, string | null>>({
    build: initialSessionId || null,
    automation: null,
    plan: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [activeFiles, setActiveFiles] = useState<string[]>([]);

  // Load sessions and messages on mount
  useEffect(() => {
    async function loadSessions() {
      try {
        const modes: TivoMode[] = ['build', 'automation', 'plan'];
        const newMessages: Record<TivoMode, Message[]> = { build: [], automation: [], plan: [] };
        const newSessionIds: Record<TivoMode, string | null> = {
          build: initialSessionId || null,
          automation: null,
          plan: null,
        };

        for (const m of modes) {
          // If we have an initial session ID for build, use it
          const sessionId = m === 'build' && initialSessionId
            ? initialSessionId
            : undefined;

          const session = sessionId
            ? { id: sessionId }
            : await hybridChatPersistence.getOrCreateSession(m);

          if (session) {
            newSessionIds[m] = session.id;
            const dbMessages = await hybridChatPersistence.getMessages(session.id);
            newMessages[m] = dbMessages.map(msg => ({
              id: msg.id,
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              timestamp: new Date(msg.created_at),
            }));
          }
        }

        setSessionIds(newSessionIds);
        setMessages(newMessages);
      } catch (e) {
        console.error('Failed to load chat sessions:', e);
      } finally {
        setSessionsLoaded(true);
      }
    }
    loadSessions();
  }, [initialSessionId]);

  const handleSendMessage = useCallback(async (content: string, files?: File[]) => {
    const messageContent = files ? `${content}\n\n📎 ${files.map(f => f.name).join(', ')}` : content;

    let currentSessionId = sessionIds[mode];
    if (!currentSessionId) {
      const session = await hybridChatPersistence.getOrCreateSession(mode);
      if (session) {
        currentSessionId = session.id;
        setSessionIds(prev => ({ ...prev, [mode]: session.id }));
      }
    }

    const savedUserMsg = currentSessionId
      ? await chatPersistence.saveMessage(currentSessionId, 'user', messageContent)
      : null;

    const userMsg: Message = {
      id: savedUserMsg?.id || crypto.randomUUID(),
      role: 'user',
      content: messageContent,
      timestamp: savedUserMsg ? new Date(savedUserMsg.created_at) : new Date(),
    };

    setMessages(prev => ({
      ...prev,
      [mode]: [...prev[mode], userMsg],
    }));
    setIsLoading(true);
    setActiveFiles([]);

    const currentMsgs = [...messages[mode], userMsg];
    const aiMessages = currentMsgs.map(m => ({ role: m.role, content: m.content }));

    const modeContext = mode === 'build'
      ? 'You are in BUILD mode. Generate code, components, and project files. Always provide working code.'
      : mode === 'automation'
      ? 'You are in AUTOMATION mode. Help with CI/CD, testing, deployment automation.'
      : 'You are in PLAN mode. Help plan projects, discuss architecture, and create roadmaps.';

    const messagesForAI = [
      { role: 'user' as const, content: `[System: ${modeContext}]` },
      ...aiMessages,
    ];

    let assistantContent = '';
    const assistantId = crypto.randomUUID();
    const toolEvents: ToolEvent[] = [];

    const updateAssistantMsg = () => {
      setMessages(prev => {
        const modeMessages = prev[mode];
        const lastMsg = modeMessages[modeMessages.length - 1];
        const msgData = { id: assistantId, role: 'assistant' as const, content: assistantContent, timestamp: new Date(), toolEvents: [...toolEvents] };
        if (lastMsg?.id === assistantId) {
          return { ...prev, [mode]: modeMessages.map(m => m.id === assistantId ? msgData : m) };
        }
        return { ...prev, [mode]: [...modeMessages, msgData] };
      });
    };

    await streamChat({
      messages: messagesForAI,
      onDelta: (chunk) => {
        assistantContent += chunk;
        updateAssistantMsg();
      },
      onToolEvent: (event) => {
        toolEvents.push(event);
        // Track active files for the loading indicator
        if (event.args?.path && typeof event.args.path === 'string') {
          setActiveFiles(prev => [...prev, event.args!.path as string]);
        }
        if (event.args?.name && typeof event.args.name === 'string') {
          setActiveFiles(prev => [...prev, event.args!.name as string]);
        }
        updateAssistantMsg();
      },
      onDone: async () => {
        if (currentSessionId && assistantContent) {
          const saved = await chatPersistence.saveMessage(currentSessionId, 'assistant', assistantContent);
          if (saved) {
            setMessages(prev => ({
              ...prev,
              [mode]: prev[mode].map(m =>
                m.id === assistantId ? { ...m, id: saved.id } : m
              ),
            }));
          }
        }
        setIsLoading(false);
        setActiveFiles([]);
      },
      onError: (error) => {
        toast({
          title: 'AI Error',
          description: error,
          variant: 'destructive',
        });
        setIsLoading(false);
      },
    });
  }, [mode, messages, sessionIds, toast]);

  const currentMessages = messages[mode];
  const isCleanSlate = mode === 'plan' && currentMessages.length === 0 && !isLoading;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex flex-col min-h-0 relative">
        <AnimatePresence mode="wait">
          {mode === 'build' && (
            <motion.div key="build" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col min-h-0">
              <BuildWorkspace messages={currentMessages} isLoading={isLoading} onOpenMenu={() => setMenuOpen(true)} activeFiles={activeFiles} />
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
                    <img src={tivoLogo} alt="TIVO AI" className="w-14 h-14 mb-4 mx-auto drop-shadow-[0_0_20px_rgba(204,0,0,0.5)]" />
                    <h1 className="text-3xl sm:text-4xl font-display font-bold mb-2 tracking-tight gradient-text-brand">
                      TIVO AI
                    </h1>
                    <p className="text-muted-foreground text-sm">
                      {t('home.greeting')}
                    </p>
                    {!hasAnyAIConfig() && (
                      <p className="text-xs text-muted-foreground/60 mt-2">
                        ⚙️ Settings → API Keys-এ key যোগ করুন অথবা মক মোডে ব্যবহার করুন
                      </p>
                    )}
                  </motion.div>
                </div>
              ) : (
                <PlanChat messages={currentMessages} isLoading={isLoading} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <SmartInputBar
        mode={mode}
        onModeChange={setMode}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />

      <ControlPanel open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
