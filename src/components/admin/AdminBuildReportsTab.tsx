import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Hammer, RefreshCw, Trash2, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, Shield, Bug, ExternalLink } from 'lucide-react';
import { listBuildReports, deleteBuildReports, type BuildReportRow } from '@/services/buildReportsService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
function fmtDur(ms: number | null) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function AdminBuildReportsTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<BuildReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try { setRows(await listBuildReports(100)); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const ch = supabase.channel('build-reports-live')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'build_reports' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };
  const toggleExpand = (id: string) => {
    const s = new Set(expanded);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpanded(s);
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size}টি রিপোর্ট স্থায়ীভাবে ডিলিট করতে চান?`)) return;
    const n = await deleteBuildReports(Array.from(selected));
    toast({ title: `${n}টি রিপোর্ট ডিলিট হয়েছে` });
    setSelected(new Set());
    await load();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Hammer className="h-4 w-4 text-primary" />
              Build Reports (Bug & Security)
            </CardTitle>
            <CardDescription>প্রতিটি বিল্ডের ধাপ, সময় এবং scan-এর ফলাফল</CardDescription>
          </div>
          <div className="flex gap-1.5">
            {selected.size > 0 && (
              <Button size="sm" variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> {selected.size} ডিলিট
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            এখনো কোনো বিল্ড রিপোর্ট নেই। ইউজাররা যখন ZIP/EXE/APK/Web বিল্ড চালাবে তখন এখানে দেখা যাবে।
          </p>
        ) : (
          <ScrollArea className="h-[500px] pr-2">
            <div className="space-y-2">
              {rows.map((r) => {
                const isOpen = expanded.has(r.id);
                const isSel = selected.has(r.id);
                const StatusIcon = r.status === 'succeeded' ? CheckCircle2 : r.status === 'failed' ? XCircle : Loader2;
                const statusColor = r.status === 'succeeded' ? 'text-emerald-500' : r.status === 'failed' ? 'text-destructive' : 'text-primary';
                const highCount = (r.findings || []).filter((f) => f.severity === 'high').length;
                return (
                  <div key={r.id} className="rounded-xl border border-border/40 bg-card/40">
                    <div className="flex items-center gap-2 p-3">
                      <Checkbox checked={isSel} onCheckedChange={() => toggle(r.id)} />
                      <button onClick={() => toggleExpand(r.id)} className="flex-1 flex items-start gap-2 text-left min-w-0">
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5 mt-1 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 mt-1 shrink-0" />}
                        <StatusIcon className={cn('h-4 w-4 mt-0.5 shrink-0', statusColor, r.status === 'running' && 'animate-spin')} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">{r.project_name}</p>
                            <Badge variant="outline" className="text-[10px] uppercase">{r.build_target}</Badge>
                            {highCount > 0 && (
                              <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive gap-1">
                                <Shield className="h-2.5 w-2.5" /> {highCount} high
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {fmtDate(r.created_at)} · {fmtDur(r.duration_ms)} · {r.status}
                          </p>
                        </div>
                      </button>
                    </div>
                    {isOpen && (
                      <div className="border-t border-border/40 p-3 space-y-3 bg-background/40">
                        {r.error && (
                          <div className="text-[11px] text-destructive font-mono bg-destructive/5 rounded p-2 break-words">
                            {r.error}
                          </div>
                        )}
                        {r.run_url && (
                          <a href={r.run_url} target="_blank" rel="noopener noreferrer"
                             className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <ExternalLink className="h-3 w-3" /> GitHub Actions run
                          </a>
                        )}
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Steps</p>
                          <div className="space-y-1">
                            {(r.steps || []).map((s) => {
                              const dur = s.startedAt && s.endedAt ? s.endedAt - s.startedAt : null;
                              return (
                                <div key={s.id} className="flex items-center justify-between gap-2 text-[11px] py-0.5">
                                  <span className="flex items-center gap-1.5 min-w-0">
                                    <span className={cn(
                                      'h-1.5 w-1.5 rounded-full shrink-0',
                                      s.status === 'done' && 'bg-emerald-500',
                                      s.status === 'error' && 'bg-destructive',
                                      s.status === 'active' && 'bg-primary animate-pulse',
                                      s.status === 'pending' && 'bg-muted-foreground/40',
                                    )} />
                                    <span className="truncate">{s.label}</span>
                                  </span>
                                  <span className="text-muted-foreground font-mono shrink-0">
                                    {dur !== null ? fmtDur(dur) : '—'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {(r.findings || []).length > 0 && (
                          <>
                            <Separator />
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                                <Bug className="h-3 w-3" /> Findings ({r.findings.length})
                              </p>
                              <div className="space-y-1">
                                {r.findings.map((f, i) => (
                                  <div key={i} className="flex items-start gap-2 text-[11px] py-0.5">
                                    <Badge variant="outline" className={cn(
                                      'text-[9px] shrink-0',
                                      f.severity === 'high' && 'border-destructive/50 text-destructive',
                                      f.severity === 'medium' && 'border-amber-500/50 text-amber-500',
                                      f.severity === 'low' && 'border-muted-foreground/40 text-muted-foreground',
                                    )}>{f.severity}</Badge>
                                    <span className="min-w-0 break-words">
                                      <span className="font-mono text-muted-foreground">{f.file}</span>
                                      {' — '}{f.message}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
