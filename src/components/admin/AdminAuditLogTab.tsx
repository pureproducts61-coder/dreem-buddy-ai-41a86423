import { useEffect, useState } from 'react';
import { ScrollText, RefreshCw, Power, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  event_type: string;
  target_table: string | null;
  target_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  note: string | null;
  created_at: string;
}

const db = supabase as unknown as { from: (t: string) => any };

export function AdminAuditLogTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await db.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(200);
    setRows((data || []) as AuditRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel('audit-log')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_audit_log' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const iconFor = (ev: string) => ev.startsWith('kill_switch') ? Power : ShieldCheck;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" />Admin Audit Log
              <Badge variant="outline" className="text-[10px]">{rows.length}</Badge>
            </CardTitle>
            <CardDescription>Every kill-switch toggle and approval decision, with timestamps.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            <ScrollText className="h-10 w-10 mx-auto mb-2 opacity-30" />
            No audit events yet.
          </div>
        ) : (
          <div className="space-y-1.5">
            {rows.map(r => {
              const Icon = iconFor(r.event_type);
              const isOpen = openId === r.id;
              return (
                <div key={r.id} className="rounded-lg border border-border/40 bg-card/50">
                  <button onClick={() => setOpenId(isOpen ? null : r.id)} className="w-full text-left px-3 py-2.5 flex items-center gap-2.5">
                    <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono truncate">{r.event_type} · <span className="text-muted-foreground">{r.target_table}</span></p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {r.actor_email || (r.actor_id ? r.actor_id.slice(0, 8) : 'system')} · {new Date(r.created_at).toLocaleString()}
                      </p>
                    </div>
                    {r.note && <Badge variant="secondary" className="text-[9px] truncate max-w-[140px]">{r.note}</Badge>}
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2">
                      {r.before && <pre className="text-[10px] bg-muted/30 rounded p-2 overflow-x-auto"><b>Before:</b> {JSON.stringify(r.before, null, 2)}</pre>}
                      {r.after && <pre className="text-[10px] bg-muted/30 rounded p-2 overflow-x-auto"><b>After:</b> {JSON.stringify(r.after, null, 2)}</pre>}
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