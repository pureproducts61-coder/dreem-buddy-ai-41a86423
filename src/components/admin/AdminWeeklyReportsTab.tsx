import { useEffect, useState } from 'react';
import { CalendarDays, RefreshCw, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as unknown as { from: (t: string) => any };

interface WeeklyReport {
  id: string;
  period_start: string;
  period_end: string;
  summary: Record<string, unknown>;
  status: string;
  created_at: string;
}

export function AdminWeeklyReportsTab() {
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await db.from('admin_weekly_reports').select('*').order('created_at', { ascending: false }).limit(20);
    setReports((data || []) as WeeklyReport[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />Weekly Security Reports
              <Badge variant="outline" className="text-[10px]">{reports.length}</Badge>
            </CardTitle>
            <CardDescription>Login, kill-switch, emergency access, recovery and regression status summary.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {reports.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
            No weekly reports generated yet.
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map((report) => {
              const isOpen = openId === report.id;
              const summary = report.summary || {};
              return (
                <div key={report.id} className="rounded-lg border border-border/40 bg-card/50">
                  <button onClick={() => setOpenId(isOpen ? null : report.id)} className="w-full text-left px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold flex-1 truncate">
                        {new Date(report.period_start).toLocaleDateString()} → {new Date(report.period_end).toLocaleDateString()}
                      </p>
                      <Badge className="text-[9px]">{report.status}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      auth {String(summary.logins ?? 0)} · recovery {String(summary.recovery_events ?? 0)} · emergency {String(summary.emergency_access_events ?? 0)}
                    </p>
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 border-t border-border/30 pt-2">
                      <pre className="text-[10px] bg-muted/30 rounded p-2 overflow-x-auto">{JSON.stringify(summary, null, 2)}</pre>
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