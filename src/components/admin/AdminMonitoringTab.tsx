import { useEffect, useMemo, useState } from 'react';
import { Users, FolderKanban, Activity, Ban, RefreshCw, Shield, ShieldOff, Search, Trash2, CheckSquare, Square } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  getAdminStats, getAllProjects, blockUser, unblockUser,
  type AdminStats, type UserProjectRow,
} from '@/services/userActivityService';
import { supabase } from '@/integrations/supabase/client';

export function AdminMonitoringTab() {
  const { toast } = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [projects, setProjects] = useState<UserProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [s, p] = await Promise.all([getAdminStats(), getAllProjects()]);
    setStats(s);
    setProjects(p);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 30000); // safety net
    // Realtime: refresh whenever projects, profiles, or blocks change
    const channel = supabase
      .channel('admin-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_projects' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_blocks' }, () => load())
      .subscribe();
    return () => { clearInterval(i); supabase.removeChannel(channel); };
  }, []);

  const handleBlock = async (uid: string, blocked: boolean) => {
    try {
      if (blocked) {
        await unblockUser(uid);
        toast({ title: 'User unblocked' });
      } else {
        await blockUser(uid, 'Blocked by admin');
        toast({ title: 'User blocked', variant: 'destructive' });
      }
      load();
    } catch (e) {
      toast({ title: 'Action failed', description: String(e), variant: 'destructive' });
    }
  };

  const filtered = useMemo(() => projects.filter(p =>
    !filter || p.name.toLowerCase().includes(filter.toLowerCase()) ||
    (p.user_email || '').toLowerCase().includes(filter.toLowerCase())
  ), [projects, filter]);

  const allSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const someSelected = selected.size > 0;

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev => {
      if (filtered.every(p => prev.has(p.id))) {
        const next = new Set(prev);
        filtered.forEach(p => next.delete(p.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach(p => next.add(p.id));
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.rpc('admin_permanent_delete_projects', { project_ids: ids });
      if (error) throw error;
      toast({ title: 'Deleted', description: `${data ?? ids.length} project(s) permanently removed.` });
      setSelected(new Set());
      setConfirmOpen(false);
      load();
    } catch (e) {
      toast({ title: 'Delete failed', description: String((e as Error).message || e), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Live stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard icon={Activity} label="Active Now" value={stats?.active_now ?? 0} sub="Last 5 min" tone="success" />
        <MetricCard icon={Users} label="Active 24h" value={stats?.active_24h ?? 0} sub={`of ${stats?.total_users ?? 0}`} tone="primary" />
        <MetricCard icon={FolderKanban} label="Projects" value={stats?.total_projects ?? 0} sub={`+${stats?.projects_24h ?? 0} today`} tone="primary" />
        <MetricCard icon={Ban} label="Blocked" value={stats?.blocked_users ?? 0} sub="Restricted users" tone={stats && stats.blocked_users > 0 ? 'warning' : 'muted'} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2"><FolderKanban className="h-5 w-5" />User Projects</CardTitle>
              <CardDescription>Live view of all projects and the users building them</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {someSelected && (
                <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete {selected.size}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh
              </Button>
            </div>
          </div>
          <div className="relative mt-3">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by user email or project name..." className="pl-8 h-8 text-sm" />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <FolderKanban className="h-10 w-10 mx-auto mb-2 opacity-30" />
              No projects yet.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <button onClick={toggleAll} aria-label="Toggle all">
                        {allSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                      </button>
                    </TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead className="hidden sm:table-cell">User</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="hidden md:table-cell">Updated</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(p => (
                    <TableRow key={p.id} className={p.blocked ? 'opacity-50' : ''} data-selected={selected.has(p.id)}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(p.id)}
                          onCheckedChange={() => toggleOne(p.id)}
                          aria-label={`Select ${p.name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {p.name}
                        {p.blocked && <Badge variant="destructive" className="ml-2 text-[9px]">BLOCKED</Badge>}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell font-mono text-xs">{p.user_email || '—'}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="text-[10px]">{p.type}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                        {new Date(p.updated_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant={p.blocked ? 'outline' : 'ghost'}
                          size="sm"
                          className={p.blocked ? '' : 'text-destructive hover:text-destructive'}
                          onClick={() => handleBlock(p.user_id, p.blocked)}
                        >
                          {p.blocked ? <><ShieldOff className="h-3 w-3 mr-1" />Unblock</> : <><Shield className="h-3 w-3 mr-1" />Block</>}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete {selected.size} project(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is irreversible. Selected projects will be removed from the database and every deletion will be recorded in the admin audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : `Delete ${selected.size}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, tone }: {
  icon: React.ElementType; label: string; value: number; sub: string;
  tone: 'success' | 'primary' | 'warning' | 'muted';
}) {
  const toneClass = {
    success: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500',
    primary: 'border-primary/30 bg-primary/5 text-primary',
    warning: 'border-orange-500/30 bg-orange-500/5 text-orange-500',
    muted: 'border-border/40 bg-muted/20 text-muted-foreground',
  }[tone];
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[10px] font-mono uppercase tracking-wider opacity-80">{label}</p>
      </div>
      <p className="text-2xl font-display font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}