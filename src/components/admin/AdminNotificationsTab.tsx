import { useEffect, useState } from 'react';
import { Bell, RefreshCw, AlertTriangle, Info, CheckCircle2, Sparkles, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  getNotifications, markNotificationRead, createNotification,
  getAdminStats, deleteNotification, type AINotification,
} from '@/services/userActivityService';

export function AdminNotificationsTab() {
  const { toast } = useToast();
  const [items, setItems] = useState<AINotification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setItems(await getNotifications());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const generateReport = async () => {
    setLoading(true);
    try {
      const stats = await getAdminStats();
      if (!stats) {
        toast({ title: 'Could not load stats', variant: 'destructive' });
        return;
      }
      const insights: string[] = [];
      if (stats.active_now > 0) insights.push(`📊 **${stats.active_now}** users active in the last 5 minutes.`);
      if (stats.projects_24h > 0) insights.push(`🚀 **${stats.projects_24h}** new projects created today (total ${stats.total_projects}).`);
      if (stats.unread_messages > 0) insights.push(`📬 **${stats.unread_messages}** unread user message(s) need your attention.`);
      if (stats.blocked_users > 0) insights.push(`🚫 **${stats.blocked_users}** user(s) currently blocked.`);
      if (stats.total_users > 0 && stats.active_24h / stats.total_users < 0.1) {
        insights.push(`⚠️ Engagement is low — only ${Math.round(stats.active_24h / stats.total_users * 100)}% of users active in 24h. Consider re-engagement.`);
      }
      if (insights.length === 0) insights.push('✨ All quiet — no urgent issues detected.');

      await createNotification(
        `System Report — ${new Date().toLocaleString()}`,
        insights.join('\n\n'),
        'report',
        stats as unknown as Record<string, unknown>,
      );
      toast({ title: 'AI report generated' });
      load();
    } catch (e) {
      toast({ title: 'Failed', description: String(e), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRead = async (id: string) => {
    await markNotificationRead(id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      setItems(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      toast({ title: 'Delete failed', description: String(err), variant: 'destructive' });
    }
  };

  const unread = items.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />AI Notifications
                {unread > 0 && <Badge variant="destructive" className="text-[10px]">{unread} new</Badge>}
              </CardTitle>
              <CardDescription>System reports and AI-generated insights</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh
              </Button>
              <Button size="sm" onClick={generateReport} disabled={loading}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />Generate Report
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-2 opacity-30" />
              No notifications yet — click <span className="font-semibold">Generate Report</span> for an AI summary.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map(n => {
                const Icon = n.type === 'warning' ? AlertTriangle
                  : n.type === 'success' ? CheckCircle2
                  : n.type === 'report' ? Sparkles
                  : Info;
                const tone = n.type === 'warning' ? 'text-orange-500'
                  : n.type === 'success' ? 'text-emerald-500' : 'text-primary';
                return (
                  <button key={n.id}
                    onClick={() => !n.read && handleRead(n.id)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      n.read ? 'border-border/30 bg-card opacity-70' : 'border-primary/30 bg-primary/5'
                    }`}>
                    <div className="flex items-start gap-2">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${tone}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold flex-1 truncate">{n.title}</p>
                          {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={(e) => handleDelete(n.id, e)} title="Delete">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {n.body && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{n.body}</p>}
                        <p className="text-[10px] text-muted-foreground/70 mt-1.5 font-mono">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
