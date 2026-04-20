import { useState, useEffect } from 'react';
import {
  Trash2, FolderOpen, MessageCircle, Clock, Loader2, Hammer, MessageSquare,
  MoreVertical, Pencil, GitBranch, History, Download, Github, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { hybridChatPersistence } from '@/services/hybridStorageService';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { BuildDeliveryDialog } from './BuildDeliveryDialog';
import { cn } from '@/lib/utils';

interface ProjectVaultProps {
  onOpenSession?: (sessionId: string, mode?: string) => void;
}

export function ProjectVault({ onOpenSession }: ProjectVaultProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<Array<{ id: string; user_id: string; mode: string; title: string; created_at: string; updated_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [messageCounts, setMessageCounts] = useState<Record<string, number>>({});
  const [buildSession, setBuildSession] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setLoading(true);
    try {
      // Load both build and plan sessions
      const [buildSessions, planSessions] = await Promise.all([
        hybridChatPersistence.getSessions('build'),
        hybridChatPersistence.getSessions('plan'),
      ]);
      const allSessions = [...buildSessions, ...planSessions]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setSessions(allSessions);

      const counts: Record<string, number> = {};
      for (const s of allSessions) {
        const msgs = await hybridChatPersistence.getMessages(s.id);
        counts[s.id] = msgs.length;
      }
      setMessageCounts(counts);
    } catch (e) {
      console.error('Failed to load sessions:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await hybridChatPersistence.deleteSession(deleteId);
    setSessions(prev => prev.filter(s => s.id !== deleteId));
    setDeleteId(null);
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  const modeInfo = {
    build: { icon: Hammer, label: 'Build', color: 'bg-primary/10 text-primary' },
    plan: { icon: MessageSquare, label: 'Plan', color: 'bg-emerald-500/10 text-emerald-500' },
  };

  function notImplemented(action: string) {
    toast({
      title: `${action} — শীঘ্রই আসছে`,
      description: 'এই ফিচারটি Phase 2-এ সক্রিয় হবে',
    });
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="px-5 pt-6 pb-4">
        <h2 className="text-xl font-display font-bold tracking-tight">{t('vault.title')}</h2>
        <p className="text-xs text-muted-foreground mt-1">প্রতিটি প্রজেক্টের ⋮ মেনু থেকে Edit / Deploy / Build access করুন</p>
      </div>

      <div className="flex-1 px-4 pb-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <FolderOpen className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">কোনো সেশন নেই</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Chat ট্যাবে কাজ শুরু করুন</p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {sessions.map((session, i) => {
              const info = modeInfo[session.mode as keyof typeof modeInfo] || modeInfo.plan;
              const ModeIcon = info.icon;
              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative rounded-2xl border border-border/40 bg-card hover:border-primary/30 hover:bg-accent/20 transition-all group overflow-hidden"
                >
                  <button
                    onClick={() => onOpenSession?.(session.id, session.mode)}
                    className="w-full text-left p-5 pr-14"
                  >
                    <h3 className="text-base font-semibold truncate pr-2">{session.title}</h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(session.updated_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {messageCounts[session.id] || 0}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full', info.color)}>
                        <ModeIcon className="h-2.5 w-2.5" />
                        {info.label}
                      </span>
                    </div>
                  </button>

                  {/* Action menu — always visible on mobile */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-3 right-3 h-9 w-9 rounded-xl bg-background/60 backdrop-blur hover:bg-background border border-border/40"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Project Actions
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => onOpenSession?.(session.id, session.mode)}>
                        <ExternalLink className="h-3.5 w-3.5 mr-2" />Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => notImplemented('Edit (নাম ও ডোমেইন)')}>
                        <Pencil className="h-3.5 w-3.5 mr-2" />Edit name & domain
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Deploy
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => notImplemented('Deploy')}>
                        <GitBranch className="h-3.5 w-3.5 mr-2" />Deploy to Vercel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => notImplemented('GitHub connect')}>
                        <Github className="h-3.5 w-3.5 mr-2" />Connect to GitHub
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setBuildSession({ id: session.id, title: session.title })}>
                        <Download className="h-3.5 w-3.5 mr-2" />Download / Build (ZIP, EXE, APK)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => notImplemented('History')}>
                        <History className="h-3.5 w-3.5 mr-2" />History
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteId(session.id)}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />Delete session
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>সেশন ডিলিট করবেন?</AlertDialogTitle>
            <AlertDialogDescription>এই সেশনের সব চ্যাট মুছে যাবে। এটি পূর্বাবস্থায় ফেরানো সম্ভব নয়।</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>ডিলিট</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BuildDeliveryDialog
        open={!!buildSession}
        onClose={() => setBuildSession(null)}
        projectName={buildSession?.title || 'tivo-project'}
        files={[]}
      />
    </div>
  );
}
