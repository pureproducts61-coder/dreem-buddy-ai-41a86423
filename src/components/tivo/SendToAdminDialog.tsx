import { useState } from 'react';
import { Send, MessageSquarePlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { sendMessageToAdmin } from '@/services/userActivityService';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SendToAdminDialog({ open, onClose }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [category, setCategory] = useState('feedback');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!user?.id || !subject.trim() || !message.trim()) {
      toast({ title: 'Subject and message are required', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      await sendMessageToAdmin(user.id, user.email, subject.trim(), message.trim(), category);
      toast({ title: 'Message sent', description: 'The admin will see your message in the panel.' });
      setSubject(''); setMessage(''); setCategory('feedback');
      onClose();
    } catch (e) {
      toast({ title: 'Failed to send', description: String(e), variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-primary" />
            Send a message to admin
          </DialogTitle>
          <DialogDescription>
            Request features, report issues, or send feedback — admin will respond.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="feedback">💬 Feedback</SelectItem>
                <SelectItem value="feature">✨ Feature request</SelectItem>
                <SelectItem value="bug">🐛 Bug report</SelectItem>
                <SelectItem value="upgrade">⚡ Upgrade request</SelectItem>
                <SelectItem value="other">📌 Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary..." maxLength={120} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your request in detail..." className="min-h-[120px] text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={sending}>
            <Send className="h-3.5 w-3.5 mr-1.5" />{sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
