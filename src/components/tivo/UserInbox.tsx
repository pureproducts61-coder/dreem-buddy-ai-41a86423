import { useEffect, useState } from 'react';
import { Inbox, Mail, MailOpen, RefreshCw, MessageSquare, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { getMyMessages, deleteMessage, type AdminMessage } from '@/services/userActivityService';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function UserInbox({ open, onClose }: Props) {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteMessage(id);
      setMessages(prev => prev.filter(m => m.id !== id));
      if (openId === id) setOpenId(null);
    } catch (err) {
      toast({ title: 'Delete failed', description: String(err), variant: 'destructive' });
    }
  };

  const load = async () => {
    setLoading(true);
    setMessages(await getMyMessages());
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    load();
    const ch = supabase.channel('user-inbox')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'admin_messages' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open]);

  const replied = messages.filter(m => m.admin_reply).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />My Messages & Admin Replies
            {replied > 0 && <Badge>{replied} reply</Badge>}
            <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={load}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto space-y-2 -mx-1 px-1">
          {messages.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-30" />
              You haven't sent any messages yet.
            </div>
          ) : messages.map(m => {
            const isOpen = openId === m.id;
            return (
              <div key={m.id} className={`rounded-lg border p-3 ${m.admin_reply ? 'border-primary/30 bg-primary/5' : 'border-border/40'}`}>
                <button onClick={() => setOpenId(isOpen ? null : m.id)} className="w-full text-left">
                  <div className="flex items-center gap-2">
                    {m.admin_reply ? <MailOpen className="h-3.5 w-3.5 text-primary" /> : <Mail className="h-3.5 w-3.5 text-muted-foreground" />}
                    <p className="text-sm font-semibold flex-1 truncate">{m.subject}</p>
                    <Badge variant="outline" className="text-[9px]">{m.category}</Badge>
                    {m.admin_reply && <Badge className="text-[9px]">replied</Badge>}
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={(e) => handleDelete(m.id, e)} title="Delete">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(m.created_at).toLocaleString()}</p>
                </button>
                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                    <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                    {m.admin_reply && (
                      <div className="rounded-md bg-primary/10 border border-primary/30 p-2.5">
                        <p className="text-[10px] font-mono uppercase text-primary mb-1">Admin reply</p>
                        <p className="text-sm whitespace-pre-wrap">{m.admin_reply}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}