import { useEffect, useState } from 'react';
import { Mail, MailOpen, RefreshCw, CheckCircle2, Inbox, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getAllMessages, markMessageHandled, type AdminMessage } from '@/services/userActivityService';
import { supabase } from '@/integrations/supabase/client';

export function AdminMessagesTab() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  const load = async () => {
    setLoading(true);
    const m = await getAllMessages();
    setMessages(m);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('admin-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_messages' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleHandle = async (id: string) => {
    try {
      await markMessageHandled(id, reply || undefined);
      toast({ title: 'Marked as handled' });
      setReply('');
      setOpenId(null);
      load();
    } catch (e) {
      toast({ title: 'Failed', description: String(e), variant: 'destructive' });
    }
  };

  const unread = messages.filter(m => m.status === 'unread').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="h-5 w-5" />User Messages
                {unread > 0 && <Badge variant="destructive" className="text-[10px]">{unread} new</Badge>}
              </CardTitle>
              <CardDescription>Messages and feedback from your users</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <Mail className="h-10 w-10 mx-auto mb-2 opacity-30" />
              No messages yet — your users haven't reached out.
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map(m => {
                const isOpen = openId === m.id;
                const isHandled = m.status === 'handled';
                return (
                  <div key={m.id}
                    className={`rounded-lg border p-3 transition-colors ${
                      isHandled ? 'border-border/30 bg-muted/20 opacity-70'
                        : m.status === 'unread' ? 'border-primary/30 bg-primary/5'
                        : 'border-border/40 bg-card'
                    }`}>
                    <button onClick={() => setOpenId(isOpen ? null : m.id)} className="w-full text-left">
                      <div className="flex items-center gap-2 mb-1">
                        {isHandled ? <MailOpen className="h-3.5 w-3.5 text-muted-foreground" />
                          : <Mail className="h-3.5 w-3.5 text-primary" />}
                        <p className="text-sm font-semibold flex-1 truncate">{m.subject}</p>
                        <Badge variant="outline" className="text-[9px]">{m.category}</Badge>
                        <Badge variant={isHandled ? 'secondary' : 'default'} className="text-[9px]">{m.status}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-mono truncate">{m.user_email || m.user_id.slice(0, 8)}</span>
                        <span>·</span>
                        <span>{new Date(m.created_at).toLocaleString()}</span>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                        <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                        {m.admin_reply && (
                          <div className="rounded-md bg-primary/5 border border-primary/20 p-2 text-xs">
                            <p className="text-[10px] font-mono uppercase text-primary mb-1">Your reply</p>
                            <p className="whitespace-pre-wrap">{m.admin_reply}</p>
                          </div>
                        )}
                        {!isHandled && (
                          <div className="space-y-2">
                            <Textarea value={reply} onChange={(e) => setReply(e.target.value)}
                              placeholder="Optional reply (visible to user)..." className="min-h-[60px] text-sm" />
                            <Button size="sm" onClick={() => handleHandle(m.id)}>
                              <CheckCircle2 className="h-3 w-3 mr-1.5" />Mark as handled
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
    </div>
  );
}
