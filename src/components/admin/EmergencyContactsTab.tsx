import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, LifeBuoy, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const db = supabase as unknown as { from: (t: string) => any };

interface EmergencyContactRow {
  id: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function EmergencyContactsTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<EmergencyContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await db.from('emergency_contacts').select('*').order('created_at', { ascending: false }).limit(100);
    setRows((data || []) as EmergencyContactRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Realtime publication intentionally excludes emergency_contacts (contains
    // user email + message). Poll every 20s instead of subscribing.
    const interval = setInterval(load, 20000);
    return () => { clearInterval(interval); };
  }, []);

  const closeRequest = async (id: string) => {
    const { error } = await db.from('emergency_contacts').update({
      status: 'handled',
      metadata: { admin_note: note || null, handled_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    setNote('');
    setOpenId(null);
    toast({ title: 'Emergency request handled' });
    load();
  };

  const openCount = rows.filter((r) => r.status === 'open').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5" />Emergency Contacts
              {openCount > 0 && <Badge variant="destructive" className="text-[10px]">{openCount} open</Badge>}
            </CardTitle>
            <CardDescription>Login, credit, and AI-access help requests sent before users can reach the inbox.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            <LifeBuoy className="h-10 w-10 mx-auto mb-2 opacity-30" />
            No emergency requests yet.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => {
              const isOpen = openId === row.id;
              const handled = row.status === 'handled';
              return (
                <div key={row.id} className={`rounded-lg border p-3 ${handled ? 'border-border/30 bg-muted/20 opacity-75' : 'border-destructive/30 bg-destructive/5'}`}>
                  <button onClick={() => setOpenId(isOpen ? null : row.id)} className="w-full text-left">
                    <div className="flex items-center gap-2 mb-1">
                      {handled ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                      <p className="text-sm font-semibold flex-1 truncate">{row.subject}</p>
                      <Badge variant="outline" className="text-[9px]">{row.source}</Badge>
                      <Badge variant={handled ? 'secondary' : 'destructive'} className="text-[9px]">{row.status}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">{row.email} · {new Date(row.created_at).toLocaleString()}</p>
                  </button>
                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                      <p className="text-sm whitespace-pre-wrap">{row.message}</p>
                      {!handled && (
                        <div className="space-y-2">
                          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal admin note..." className="min-h-[60px] text-sm" />
                          <Button size="sm" onClick={() => closeRequest(row.id)}>
                            <CheckCircle2 className="h-3 w-3 mr-1.5" />Mark handled
                          </Button>
                        </div>
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