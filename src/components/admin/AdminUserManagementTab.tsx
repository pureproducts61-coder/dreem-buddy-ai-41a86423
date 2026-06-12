import { useEffect, useMemo, useState } from 'react';
import {
  Users, RefreshCw, Search, Shield, ShieldOff, Send, UserCheck, UserX,
  Activity, Coins, ScrollText, MessageSquare, Sparkles, Loader2, Mail,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  blockUser, unblockUser, updateUserAccess, sendNotificationToUser,
  getUserActivity, type UserActivityRow,
} from '@/services/userActivityService';

interface UserRow {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  credits: number;
  approved: boolean | null;
  approval_status: string | null;
  last_active: string | null;
  created_at: string;
}

interface BlockRow { user_id: string; reason: string | null }

const db = supabase as unknown as { rpc: (n: string, a?: any) => any; from: (t: string) => any };

function timeAgo(d: string | null): string {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function AdminUserManagementTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [blocks, setBlocks] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [activity, setActivity] = useState<UserActivityRow[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgSending, setMsgSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: profiles }, { data: blockRows }] = await Promise.all([
        db.rpc('admin_list_profiles'),
        db.from('user_blocks').select('user_id, reason'),
      ]);
      setUsers((profiles || []) as UserRow[]);
      const map: Record<string, string | null> = {};
      ((blockRows || []) as BlockRow[]).forEach(b => { map[b.user_id] = b.reason; });
      setBlocks(map);
    } catch (e) {
      toast({ title: 'Failed to load users', description: String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase.channel('admin-users-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_blocks' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setActivityLoading(true);
    getUserActivity(selected.user_id, 80).then(rows => {
      if (!cancelled) { setActivity(rows); setActivityLoading(false); }
    });
    const ch = supabase.channel(`user-activity-${selected.user_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_projects', filter: `user_id=eq.${selected.user_id}` }, () => {
        getUserActivity(selected.user_id, 80).then(setActivity);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_audit_log' }, () => {
        getUserActivity(selected.user_id, 80).then(setActivity);
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [selected?.user_id]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return users;
    return users.filter(u =>
      (u.email || '').toLowerCase().includes(f) ||
      (u.display_name || '').toLowerCase().includes(f) ||
      u.user_id.toLowerCase().includes(f),
    );
  }, [users, filter]);

  const counts = useMemo(() => ({
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    blocked: Object.keys(blocks).length,
    activeNow: users.filter(u => u.last_active && Date.now() - new Date(u.last_active).getTime() < 5 * 60_000).length,
  }), [users, blocks]);

  const handleBlock = async (u: UserRow) => {
    const isBlocked = u.user_id in blocks;
    try {
      if (isBlocked) {
        await unblockUser(u.user_id);
        toast({ title: 'User unblocked', description: u.email || u.user_id });
      } else {
        await blockUser(u.user_id, 'Blocked by admin');
        toast({ title: 'User blocked', description: u.email || u.user_id, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Action failed', description: String(e), variant: 'destructive' });
    }
  };

  const handleApprove = async (u: UserRow, approve: boolean) => {
    try {
      await updateUserAccess(u.user_id, {
        approved: approve,
        approvalStatus: approve ? 'approved' : 'suspended',
        adminNote: approve ? 'Approved from User Management' : 'Suspended from User Management',
      });
      toast({ title: approve ? 'User approved' : 'User suspended' });
    } catch (e) {
      toast({ title: 'Action failed', description: String(e), variant: 'destructive' });
    }
  };

  const handleAdjustCredits = async (u: UserRow, delta: number) => {
    const next = Math.max(0, u.credits + delta);
    try {
      await updateUserAccess(u.user_id, { newCredits: next, adminNote: `Credit adjustment ${delta > 0 ? '+' : ''}${delta}` });
    } catch (e) {
      toast({ title: 'Action failed', description: String(e), variant: 'destructive' });
    }
  };

  const handleSendMessage = async () => {
    if (!selected || !msgTitle.trim()) return;
    setMsgSending(true);
    try {
      await sendNotificationToUser(selected.user_id, msgTitle.trim(), msgBody.trim(), 'info');
      toast({ title: 'Message delivered', description: selected.email || selected.user_id });
      setMsgOpen(false); setMsgTitle(''); setMsgBody('');
    } catch (e) {
      toast({ title: 'Send failed', description: String(e), variant: 'destructive' });
    } finally {
      setMsgSending(false);
    }
  };

  const iconForKind: Record<UserActivityRow['kind'], React.ElementType> = {
    project: Sparkles, credit: Coins, audit: ScrollText, message: MessageSquare,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />User Management</CardTitle>
            <CardDescription>Realtime view of every user · click a row for activity, block, approve, or message</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
          <Metric label="Total" value={counts.total} tone="primary" />
          <Metric label="Active now" value={counts.activeNow} tone="success" />
          <Metric label="Admins" value={counts.admins} tone="primary" />
          <Metric label="Blocked" value={counts.blocked} tone={counts.blocked > 0 ? 'warning' : 'muted'} />
        </div>

        <div className="relative mt-3">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Filter by email, name, or id…" className="pl-8 h-8 text-sm" />
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
            {loading ? 'Loading users…' : 'No users match the filter.'}
          </div>
        ) : (
          filtered.map(u => {
            const isBlocked = u.user_id in blocks;
            const isAdmin = u.role === 'admin';
            const status = u.approval_status || (u.approved ? 'approved' : 'pending');
            return (
              <div key={u.user_id}
                className={`rounded-lg border bg-card/60 transition-colors ${isBlocked ? 'opacity-60 border-destructive/40' : 'border-border/40 hover:border-primary/40'}`}>
                <button onClick={() => setSelected(u)} className="w-full text-left p-3 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full grid place-items-center text-xs font-semibold ${isAdmin ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {(u.email || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{u.display_name || u.email || u.user_id.slice(0, 8)}</p>
                      {isAdmin && <Badge className="text-[9px] h-4">ADMIN</Badge>}
                      {isBlocked && <Badge variant="destructive" className="text-[9px] h-4">BLOCKED</Badge>}
                      <Badge variant="outline" className="text-[9px] h-4 capitalize">{status}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate font-mono">{u.email}</p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-[11px] text-muted-foreground">Active {timeAgo(u.last_active)}</p>
                    <p className="text-[10px] font-mono text-primary">{u.credits} cr</p>
                  </div>
                </button>

                <div className="flex items-center gap-1 px-3 pb-2.5 flex-wrap">
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => { setSelected(u); setMsgOpen(true); }}>
                    <Send className="h-3 w-3 mr-1" />Message
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => handleAdjustCredits(u, 10)}>+10 cr</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => handleAdjustCredits(u, -10)}>-10 cr</Button>
                  {!isAdmin && (status !== 'approved'
                    ? <Button size="sm" variant="ghost" className="h-7 text-[11px] text-emerald-500" onClick={() => handleApprove(u, true)}>
                        <UserCheck className="h-3 w-3 mr-1" />Approve
                      </Button>
                    : <Button size="sm" variant="ghost" className="h-7 text-[11px] text-orange-500" onClick={() => handleApprove(u, false)}>
                        <UserX className="h-3 w-3 mr-1" />Suspend
                      </Button>
                  )}
                  {!isAdmin && (
                    <Button size="sm" variant="ghost" className={`h-7 text-[11px] ${isBlocked ? 'text-emerald-500' : 'text-destructive'}`} onClick={() => handleBlock(u)}>
                      {isBlocked ? <><ShieldOff className="h-3 w-3 mr-1" />Unblock</> : <><Shield className="h-3 w-3 mr-1" />Block</>}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      {/* Activity drawer (dialog) */}
      <Dialog open={!!selected && !msgOpen} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  {selected.display_name || selected.email || selected.user_id.slice(0, 12)}
                </DialogTitle>
                <DialogDescription className="font-mono text-[11px]">
                  {selected.email} · {selected.user_id}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Metric label="Credits" value={selected.credits} tone="primary" />
                <Metric label="Role" valueText={selected.role} tone={selected.role === 'admin' ? 'primary' : 'muted'} />
                <Metric label="Status" valueText={selected.approval_status || 'pending'} tone="muted" />
                <Metric label="Last active" valueText={timeAgo(selected.last_active)} tone="muted" />
              </div>

              <div className="flex gap-2 flex-wrap pt-1">
                <Button size="sm" onClick={() => setMsgOpen(true)}><Mail className="h-3.5 w-3.5 mr-1.5" />Send message</Button>
                <Button size="sm" variant="outline" onClick={() => getUserActivity(selected.user_id, 80).then(setActivity)}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh activity
                </Button>
              </div>

              <div className="border-t border-border/40 pt-3">
                <p className="text-[11px] uppercase font-mono text-muted-foreground mb-2">Recent activity</p>
                {activityLoading ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…
                  </div>
                ) : activity.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {activity.map((a, i) => {
                      const Icon = iconForKind[a.kind] || Activity;
                      return (
                        <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-md bg-muted/30 border border-border/30">
                          <Icon className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{a.title}</p>
                            {a.detail && <p className="text-[10px] text-muted-foreground truncate">{a.detail}</p>}
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(a.occurred_at)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Send message dialog */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="h-4 w-4" />Message {selected?.email || 'user'}</DialogTitle>
            <DialogDescription>This will appear in the user's inbox immediately and is logged in the audit trail.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={msgTitle} onChange={e => setMsgTitle(e.target.value)} placeholder="Subject" maxLength={200} />
            <Textarea value={msgBody} onChange={e => setMsgBody(e.target.value)} placeholder="Message body…" rows={5} maxLength={4000} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMsgOpen(false)} disabled={msgSending}>Cancel</Button>
            <Button onClick={handleSendMessage} disabled={msgSending || !msgTitle.trim()}>
              {msgSending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Metric({ label, value, valueText, tone }: {
  label: string; value?: number; valueText?: string;
  tone: 'primary' | 'success' | 'warning' | 'muted';
}) {
  const toneClass = {
    primary: 'border-primary/30 bg-primary/5 text-primary',
    success: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500',
    warning: 'border-orange-500/30 bg-orange-500/5 text-orange-500',
    muted: 'border-border/40 bg-muted/20 text-muted-foreground',
  }[tone];
  return (
    <div className={`rounded-lg border p-2 ${toneClass}`}>
      <p className="text-[10px] font-mono uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-lg font-display font-bold text-foreground truncate">{value ?? valueText}</p>
    </div>
  );
}