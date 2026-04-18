import { useState, useCallback, useEffect } from 'react';
import tivoLogo from '@/assets/tivo-logo.png';
import { SmartInputBar, TivoMode } from '@/components/tivo/SmartInputBar';
import { BuildWorkspace } from '@/components/tivo/BuildWorkspace';
import { AutomationWorkspace } from '@/components/tivo/AutomationWorkspace';
import { PlanChat } from '@/components/tivo/PlanChat';
import { ControlPanel } from '@/components/tivo/ControlPanel';
import { SuggestionChips } from '@/components/tivo/SuggestionChips';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { streamChat, hasAnyAIConfig, type ToolEvent } from '@/services/aiChatService';
import { hybridChatPersistence } from '@/services/hybridStorageService';
import { useToast } from '@/hooks/use-toast';
import { extractAndPreviewCode } from '@/services/previewBridge';
import { Plus } from 'lucide-react';

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

// Extract suggestion chips from AI response
function extractSuggestions(content: string): string[] {
  // Match lines like: - **suggestion text** or • suggestion text at the end
  const suggestions: string[] = [];
  const lines = content.split('\n');
  const lastLines = lines.slice(-10);
  
  for (const line of lastLines) {
    const match = line.match(/^[-•]\s*\*{0,2}(.+?)\*{0,2}\s*$/);
    if (match && match[1].length < 80 && match[1].length > 5) {
      suggestions.push(match[1].trim());
    }
  }
  
  return suggestions.slice(0, 4);
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
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Only load messages when user explicitly opens a session from Vault
  useEffect(() => {
    async function loadOpenedSession() {
      if (!initialSessionId) {
        // Fresh start — no auto-load
        setSessionsLoaded(true);
        return;
      }
      try {
        const targetMode = (initialMode || 'build') as TivoMode;
        const dbMessages = await hybridChatPersistence.getMessages(initialSessionId);
        setSessionIds(prev => ({ ...prev, [targetMode]: initialSessionId }));
        setMessages(prev => ({
          ...prev,
          [targetMode]: dbMessages.map(msg => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: new Date(msg.created_at),
          })),
        }));
      } catch (e) {
        console.error('Failed to load session:', e);
      } finally {
        setSessionsLoaded(true);
      }
    }
    loadOpenedSession();
  }, [initialSessionId, initialMode]);

  // Start a fresh new chat in the current mode
  const handleNewChat = useCallback(async () => {
    setSuggestions([]);
    setMessages(prev => ({ ...prev, [mode]: [] }));
    setSessionIds(prev => ({ ...prev, [mode]: null }));
    setActiveFiles([]);
  }, [mode]);

  const handleSendMessage = useCallback(async (content: string, files?: File[]) => {
    setSuggestions([]);
    
    // Read file contents if any
    let messageContent = content;
    if (files && files.length > 0) {
      const fileContents: string[] = [];
      for (const file of files) {
        try {
          if (file.type.startsWith('text/') || file.name.match(/\.(json|md|txt|csv|tsx?|jsx?|html|css|py|yml|yaml|xml|sql|sh|env|toml|cfg|ini)$/i)) {
            const text = await file.text();
            fileContents.push(`📄 **${file.name}**:\n\`\`\`\n${text}\n\`\`\``);
          } else if (file.type.startsWith('image/')) {
            fileContents.push(`🖼️ **${file.name}** (image file, ${(file.size / 1024).toFixed(1)}KB)`);
          } else {
            fileContents.push(`📎 **${file.name}** (${file.type || 'unknown'}, ${(file.size / 1024).toFixed(1)}KB)`);
          }
        } catch {
          fileContents.push(`📎 **${file.name}** (could not read)`);
        }
      }
      messageContent = `${content}\n\n${fileContents.join('\n\n')}`;
    }

    let currentSessionId = sessionIds[mode];
    if (!currentSessionId) {
      // Create a brand new session for this conversation
      const session = await hybridChatPersistence.createNewSession(mode);
      if (session) {
        currentSessionId = session.id;
        setSessionIds(prev => ({ ...prev, [mode]: session.id }));
      }
    }

    // Auto-title session from first message
    if (currentSessionId && messages[mode].length === 0) {
      const title = content.slice(0, 60) + (content.length > 60 ? '...' : '');
      await hybridChatPersistence.updateSessionTitle(currentSessionId, title);
    }

    const savedUserMsg = currentSessionId
      ? await hybridChatPersistence.saveMessage(currentSessionId, 'user', messageContent)
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
      ? 'You are in BUILD mode. Generate code, components, and project files. Always provide working code. After completing work, suggest 2-3 next steps as bullet points.'
      : mode === 'automation'
      ? 'You are in AUTOMATION mode. Help with CI/CD, testing, deployment automation.'
      : 'You are in PLAN mode. Help plan projects, discuss architecture, and create roadmaps. Be conversational and detailed. After each response, suggest 2-3 follow-up questions or next steps as bullet points.';

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
          const saved = await hybridChatPersistence.saveMessage(currentSessionId, 'assistant', assistantContent);
          if (saved) {
            setMessages(prev => ({
              ...prev,
              [mode]: prev[mode].map(m =>
                m.id === assistantId ? { ...m, id: saved.id } : m
              ),
            }));
          }
        }
        // Extract suggestions from the response
        const extracted = extractSuggestions(assistantContent);
        setSuggestions(extracted);
        
        // In build mode, try to extract code and send to preview
        if (mode === 'build' && assistantContent) {
          extractAndPreviewCode(assistantContent);
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

  const handleSuggestionSelect = useCallback((suggestion: string) => {
    setSuggestions([]);
    handleSendMessage(suggestion);
  }, [handleSendMessage]);

  const currentMessages = messages[mode];
  const isCleanSlate = mode === 'plan' && currentMessages.length === 0 && !isLoading;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Floating New Chat button — appears when conversation has messages */}
        {currentMessages.length > 0 && (
          <button
            onClick={handleNewChat}
            className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/90 backdrop-blur-md border border-border/40 text-xs font-medium text-foreground hover:bg-secondary transition-colors shadow-md"
            title="Start new chat"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        )}
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

      {/* Suggestion Chips */}
      {!isLoading && suggestions.length > 0 && (
        <SuggestionChips suggestions={suggestions} onSelect={handleSuggestionSelect} />
      )}

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
