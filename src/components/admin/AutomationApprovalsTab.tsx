import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { decideApproval, listApprovals, type AutomationApproval } from '@/services/approvalService';

export function AutomationApprovalsTab() {
  const { toast } = useToast();
  const [items, setItems] = useState<AutomationApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const load = async () => {
    setLoading(true);
    setItems(await listApprovals());
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel('approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'automation_approvals' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await decideApproval(id, status, note || undefined);
      toast({ title: status === 'approved' ? '✅ Approved' : '❌ Rejected' });
      setNote(''); setOpenId(null);
    } catch (e) {
      toast({ title: 'Error', description: String(e), variant: 'destructive' });
    }
  };

  const pending = items.filter(i => i.status === 'pending').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />Automation Approvals
              {pending > 0 && <Badge variant="destructive" className="text-[10px]">{pending} pending</Badge>}
            </CardTitle>
            <CardDescription>Every major business or financial action waits here for your verify.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
            No approval requests yet.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(a => {
              const isOpen = openId === a.id;
              const tone = a.status === 'pending' ? 'border-primary/40 bg-primary/5'
                : a.status === 'approved' ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-destructive/30 bg-destructive/5 opacity-80';
              return (
                <div key={a.id} className={`rounded-lg border p-3 ${tone}`}>
                  <button onClick={() => setOpenId(isOpen ? null : a.id)} className="w-full text-left">
                    <div className="flex items-center gap-2 mb-1">
                      {a.status === 'pending' ? <Clock className="h-3.5 w-3.5 text-primary" />
                        : a.status === 'approved' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                      <p className="text-sm font-semibold flex-1 truncate">{a.title}</p>
                      <Badge variant="outline" className="text-[9px]">{a.action_type}</Badge>
                      <Badge className="text-[9px]">{a.status}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      {a.user_email || a.user_id.slice(0, 8)} · {new Date(a.created_at).toLocaleString()}
                    </p>
                  </button>
                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                      <pre className="text-[11px] bg-muted/40 rounded p-2 overflow-x-auto">{JSON.stringify(a.details, null, 2)}</pre>
                      {a.admin_note && <p className="text-xs italic">Note: {a.admin_note}</p>}
                      {a.status === 'pending' && (
                        <>
                          <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note for the user…" className="min-h-[50px] text-sm" />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => decide(a.id, 'approved')}>
                              <CheckCircle2 className="h-3 w-3 mr-1.5" />Verify & Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => decide(a.id, 'rejected')}>
                              <XCircle className="h-3 w-3 mr-1.5" />Reject
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
