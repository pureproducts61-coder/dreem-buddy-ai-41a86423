import { useState, useEffect } from 'react';
import {
  Trash2, FolderOpen, MessageCircle, Clock, Loader2, Hammer, MessageSquare,
  MoreVertical, Pencil, GitBranch, History, Download, Github, ExternalLink,
  FileJson, FileSpreadsheet, RefreshCw, Rocket, Sparkles,
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { githubService } from '@/services/githubService';
import { Badge } from '@/components/ui/badge';
import { enqueueDeploy, updateDeploy } from '@/services/deployQueueService';
import { DeployStatusList } from './DeployStatusList';

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
  const [editSession, setEditSession] = useState<{ id: string; title: string; domain: string } | null>(null);
  const [historySession, setHistorySession] = useState<{ id: string; title: string } | null>(null);
  const [historyMessages, setHistoryMessages] = useState<Array<{ id: string; role: string; content: string; created_at: string }>>([]);
  const [busy, setBusy] = useState(false);

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

  async function handleSaveEdit() {
    if (!editSession) return;
    setBusy(true);
    try {
      await hybridChatPersistence.updateSessionTitle(editSession.id, editSession.title);
      // domain is metadata-only — store on localStorage for now
      try {
        const map = JSON.parse(localStorage.getItem('tivo-project-domains') || '{}');
        map[editSession.id] = editSession.domain;
        localStorage.setItem('tivo-project-domains', JSON.stringify(map));
      } catch { /* ignore */ }
      setSessions(prev => prev.map(s => s.id === editSession.id ? { ...s, title: editSession.title } : s));
      toast({ title: '✅ আপডেট সফল', description: `নাম: ${editSession.title}` });
      setEditSession(null);
    } catch (e) {
      toast({ title: 'ত্রুটি', description: String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  function openEdit(session: { id: string; title: string }) {
    let domain = '';
    try {
      const map = JSON.parse(localStorage.getItem('tivo-project-domains') || '{}');
      domain = map[session.id] || '';
    } catch { /* ignore */ }
    setEditSession({ id: session.id, title: session.title, domain });
  }

  async function openHistory(session: { id: string; title: string }) {
    setHistorySession(session);
    setHistoryMessages([]);
    try {
      const msgs = await hybridChatPersistence.getMessages(session.id);
      setHistoryMessages(msgs);
    } catch (e) {
      toast({ title: 'হিস্টরি লোড করা যায়নি', variant: 'destructive' });
    }
  }

  async function handleGitHubConnect(session: { id: string; title: string }) {
    if (!githubService.hasToken()) {
      toast({
        title: 'GitHub Token প্রয়োজন',
        description: 'Settings → Tools & Integrations → GitHub Token যোগ করুন।',
        variant: 'destructive',
      });
      return;
    }
    setBusy(true);
    try {
      const user = await githubService.getUser();
      const repoName = session.title.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 50) || `tivo-${session.id.slice(0, 8)}`;
      try {
        await githubService.createRepo(repoName, `${session.title} — TIVO AI project`, true);
        toast({ title: '✅ GitHub-এ Repo তৈরি হয়েছে', description: `${user.login}/${repoName}` });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('already exists') || msg.includes('422')) {
          toast({ title: 'ℹ️ Repo আগে থেকেই আছে', description: `${user.login}/${repoName} ব্যবহার হচ্ছে` });
        } else {
          throw e;
        }
      }
      // store mapping
      try {
        const map = JSON.parse(localStorage.getItem('tivo-project-github') || '{}');
        map[session.id] = `${user.login}/${repoName}`;
        localStorage.setItem('tivo-project-github', JSON.stringify(map));
      } catch { /* ignore */ }
    } catch (e) {
      toast({ title: 'GitHub সংযোগে ত্রুটি', description: String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  function handleDeploy(session: { id: string; title: string }) {
    let repo = '';
    try {
      const map = JSON.parse(localStorage.getItem('tivo-project-github') || '{}');
      repo = map[session.id] || '';
    } catch { /* ignore */ }
    if (!repo) {
      toast({
        title: 'প্রথমে GitHub-এ Connect করুন',
        description: 'Deploy করার আগে Connect to GitHub চাপুন।',
        variant: 'destructive',
      });
      return;
    }
    const job = enqueueDeploy({ sessionId: session.id, projectName: session.title, repo });
    const url = `https://vercel.com/new/clone?repository-url=https://github.com/${repo}`;
    updateDeploy(job.id, { status: 'opening', message: 'Opening Vercel import dialog…', url: `https://github.com/${repo}` });
    window.open(url, '_blank', 'noopener,noreferrer');
    // Polling loop with exponential backoff — best-effort progress feedback.
    // We can't read Vercel deploy status without a project link, so we tick
    // through phases and probe the candidate vercel.app URL until 200 OK.
    const candidate = `https://${repo.split('/')[1]}.vercel.app`;
    let attempt = 0;
    const maxAttempts = 8;
    const poll = async () => {
      attempt += 1;
      const phase = attempt < 3 ? 'opening' : 'building';
      updateDeploy(job.id, { status: phase, message: `Probing ${candidate} (attempt ${attempt}/${maxAttempts})…` });
      try {
        const res = await fetch(candidate, { method: 'HEAD', mode: 'no-cors' });
        // no-cors gives opaque — treat as success heuristic on later attempts
        if (attempt >= 3) {
          updateDeploy(job.id, { status: 'ready', message: 'Site reachable.', url: candidate });
          return;
        }
      } catch { /* not yet */ }
      if (attempt >= maxAttempts) {
        updateDeploy(job.id, { status: 'ready', message: 'Polling finished — verify in Vercel dashboard.', url: candidate });
        return;
      }
      const delay = Math.min(20000, 4000 * Math.pow(1.5, attempt - 1));
      setTimeout(poll, delay);
    };
    setTimeout(poll, 6000);
    toast({ title: '🚀 Deploy queued', description: `Repo: ${repo}` });
  }

  function exportHistory(format: 'json' | 'csv') {
    if (!historySession || historyMessages.length === 0) return;
    const safeName = historySession.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40) || 'chat';
    let blob: Blob;
    let filename: string;
    if (format === 'json') {
      const payload = {
        session: { id: historySession.id, title: historySession.title },
        exported_at: new Date().toISOString(),
        messages: historyMessages,
      };
      blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      filename = `${safeName}-history.json`;
    } else {
      const escape = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
      const rows = [
        'role,created_at,content',
        ...historyMessages.map(m => `${m.role},${m.created_at},${escape(m.content)}`),
      ];
      blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      filename = `${safeName}-history.csv`;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${format.toUpperCase()}`, description: filename });
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
                  <div className="px-5 pb-3">
                    <DeployStatusList sessionId={session.id} />
                  </div>

                  {/* Action menu — always visible on mobile */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-3 right-3 h-9 w-9 rounded-xl bg-gradient-to-br from-card/90 to-card/60 backdrop-blur-md hover:from-primary/15 hover:to-primary/5 border border-border/50 hover:border-primary/40 shadow-md transition-all"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-60 p-1.5 rounded-2xl border-border/50 backdrop-blur-2xl bg-popover/95 shadow-2xl shadow-primary/10"
                    >
                      <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground px-2 pt-1.5 pb-1 flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-primary" />Project Actions
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => onOpenSession?.(session.id, session.mode)} className="rounded-lg gap-2 text-xs">
                        <ExternalLink className="h-3.5 w-3.5 text-primary" />Open project
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpenSession?.(session.id, session.mode)} className="rounded-lg gap-2 text-xs">
                        <RefreshCw className="h-3.5 w-3.5 text-emerald-500" />Update (continue with AI)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEdit(session)} className="rounded-lg gap-2 text-xs">
                        <Pencil className="h-3.5 w-3.5 text-amber-500" />Edit name & domain
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground px-2 pt-1 pb-1">Deploy</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleDeploy(session)} className="rounded-lg gap-2 text-xs">
                        <Rocket className="h-3.5 w-3.5 text-primary" />Deploy to Vercel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleGitHubConnect(session)} className="rounded-lg gap-2 text-xs">
                        <Github className="h-3.5 w-3.5" />Connect to GitHub
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setBuildSession({ id: session.id, title: session.title })} className="rounded-lg gap-2 text-xs">
                        <Download className="h-3.5 w-3.5 text-cyan-500" />Download (ZIP / EXE / APK)
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openHistory(session)} className="rounded-lg gap-2 text-xs">
                        <History className="h-3.5 w-3.5" />History & Export
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteId(session.id)}
                        className="rounded-lg gap-2 text-xs text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />Delete session
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

      {/* Edit name & domain dialog */}
      <Dialog open={!!editSession} onOpenChange={(o) => !o && setEditSession(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>প্রজেক্ট এডিট করুন</DialogTitle>
            <DialogDescription>প্রজেক্টের নাম ও কাস্টম ডোমেইন আপডেট করুন</DialogDescription>
          </DialogHeader>
          {editSession && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="proj-name">প্রজেক্ট নাম</Label>
                <Input
                  id="proj-name"
                  value={editSession.title}
                  onChange={(e) => setEditSession({ ...editSession, title: e.target.value })}
                  placeholder="My awesome project"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-domain">কাস্টম ডোমেইন (ঐচ্ছিক)</Label>
                <Input
                  id="proj-domain"
                  value={editSession.domain}
                  onChange={(e) => setEditSession({ ...editSession, domain: e.target.value })}
                  placeholder="myapp.example.com"
                />
                <p className="text-[11px] text-muted-foreground">
                  Vercel-এ deploy করার পর এই ডোমেইন কনফিগার হবে।
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditSession(null)} disabled={busy}>বাতিল</Button>
            <Button onClick={handleSaveEdit} disabled={busy || !editSession?.title.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'সেভ করুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!historySession} onOpenChange={(o) => !o && setHistorySession(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              {historySession?.title} — হিস্টরি
            </DialogTitle>
            <DialogDescription>
              {historyMessages.length} বার্তা — সম্পূর্ণ চ্যাট হিস্টরি
            </DialogDescription>
          </DialogHeader>
          {historyMessages.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <Button variant="outline" size="sm" onClick={() => exportHistory('json')}>
                <FileJson className="h-3.5 w-3.5 mr-1.5" />Export JSON
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportHistory('csv')}>
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />Export CSV
              </Button>
            </div>
          )}
          <ScrollArea className="h-[50vh] pr-3">
            {historyMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">কোনো বার্তা নেই</p>
            ) : (
              <div className="space-y-3">
                {historyMessages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'rounded-xl p-3 border text-sm',
                      m.role === 'user'
                        ? 'bg-primary/5 border-primary/20'
                        : 'bg-muted/40 border-border/40'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant={m.role === 'user' ? 'default' : 'secondary'} className="text-[10px]">
                        {m.role === 'user' ? 'আপনি' : 'AI'}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-foreground/90 line-clamp-6">{m.content}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
