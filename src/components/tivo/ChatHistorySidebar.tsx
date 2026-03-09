import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Plus, Trash2, X, Clock, ChevronRight } from 'lucide-react';
import { chatPersistence, type ChatSession } from '@/services/chatPersistenceService';
import { cn } from '@/lib/utils';
import type { TivoMode } from '@/components/tivo/SmartInputBar';

interface ChatHistorySidebarProps {
  open: boolean;
  onClose: () => void;
  currentMode: TivoMode;
  currentSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
  onNewSession: () => void;
}

const modeLabels: Record<TivoMode, string> = {
  build: '🔨 Build',
  automation: '⚙️ Automation',
  plan: '📋 Plan',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export function ChatHistorySidebar({
  open,
  onClose,
  currentMode,
  currentSessionId,
  onSelectSession,
  onNewSession,
}: ChatHistorySidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<TivoMode | 'all'>('all');

  useEffect(() => {
    if (!open) return;
    loadSessions();
  }, [open]);

  async function loadSessions() {
    setLoading(true);
    try {
      const all = await chatPersistence.getSessions();
      setSessions(all);
    } catch (e) {
      console.error('Failed to load sessions:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    await chatPersistence.deleteSession(sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  }

  const filteredSessions = filterMode === 'all'
    ? sessions
    : sessions.filter(s => s.mode === filterMode);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 z-50 w-80 bg-card border-r border-border/30 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Chat History</span>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/80 transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* New Session Button */}
            <div className="px-3 pt-3 pb-1">
              <button
                onClick={() => { onNewSession(); onClose(); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>New {modeLabels[currentMode]} Session</span>
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 px-3 py-2">
              {(['all', 'plan', 'build', 'automation'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterMode(f)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                    filterMode === f
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-secondary/60'
                  )}
                >
                  {f === 'all' ? 'All' : modeLabels[f]}
                </button>
              ))}
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  Loading...
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No sessions yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredSessions.map((session) => {
                    const isActive = session.id === currentSessionId;
                    return (
                      <motion.button
                        key={session.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => { onSelectSession(session); onClose(); }}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all group',
                          isActive
                            ? 'bg-primary/10 border border-primary/20'
                            : 'hover:bg-secondary/60 border border-transparent'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-medium opacity-60">
                              {modeLabels[session.mode as TivoMode] || session.mode}
                            </span>
                          </div>
                          <p className={cn(
                            'text-sm truncate',
                            isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                          )}>
                            {session.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                            {formatDate(session.updated_at)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleDelete(session.id, e)}
                            className="p-1 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Delete session"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
