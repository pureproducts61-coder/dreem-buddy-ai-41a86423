import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { lastSelfTest, runSelfTest, type SelfTestReport } from '@/services/os/selfTest';
import { getWorkspaceState, bootstrapWorkspace } from '@/services/os/workspace';
import { checkForAppUpdate, applyAppUpdate } from '@/services/os/updates';
import { toast } from 'sonner';

export default function SelfTestPanel() {
  const [report, setReport] = useState<SelfTestReport | null>(lastSelfTest());
  const [running, setRunning] = useState(false);
  const [workspace, setWorkspace] = useState(getWorkspaceState());

  useEffect(() => { if (!report) run(); /* eslint-disable-next-line */ }, []);

  const run = async () => {
    setRunning(true);
    try { setReport(await runSelfTest()); setWorkspace(getWorkspaceState()); }
    finally { setRunning(false); }
  };

  const icon = (s: 'pass' | 'warn' | 'fail') =>
    s === 'pass' ? <CheckCircle2 className="h-4 w-4 text-primary" />
      : s === 'warn' ? <AlertTriangle className="h-4 w-4 text-muted-foreground" />
      : <XCircle className="h-4 w-4 text-destructive" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">System self test</CardTitle>
          <CardDescription>
            Checks the Bridge, runtime, vision, models, plugins, permissions and the offline workspace,
            then tells you exactly what to do about anything missing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={run} disabled={running}>
              {running ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Run self test
            </Button>
            <Button size="sm" variant="outline" onClick={async () => {
              const ready = await checkForAppUpdate();
              ready ? applyAppUpdate() : toast.success('You are on the latest version');
            }}>Check for updates</Button>
            <Button size="sm" variant="outline" onClick={async () => {
              setWorkspace(await bootstrapWorkspace());
              toast.success('Local workspace repaired');
            }}>Repair workspace</Button>
          </div>
          {report && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {report.summary} · {report.passed} ok · {report.warnings} warnings · {report.failures} failures
            </p>
          )}
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardHeader><CardTitle className="text-base">Diagnostics</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {report.results.map((res) => (
              <div key={res.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                <span className="mt-0.5">{icon(res.status)}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{res.label}</p>
                  <p className="text-xs text-muted-foreground">{res.detail}</p>
                  {res.action && <p className="mt-1 text-[11px] text-primary">{res.action}</p>}
                </div>
                <Badge variant={res.status === 'pass' ? 'default' : 'secondary'} className="ml-auto text-[10px]">{res.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Local workspace</CardTitle>
          <CardDescription>Created automatically on first launch so everything keeps working offline.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          {workspace ? (
            <>
              <p>Created {new Date(workspace.createdAt).toLocaleString()} · {workspace.quotaGb.toFixed(1)} GB available{workspace.persistent ? ' · persistent storage' : ''}</p>
              <div className="flex flex-wrap gap-1">
                {workspace.folders.map((f) => <code key={f} className="rounded bg-muted px-1.5 py-0.5">{f}</code>)}
              </div>
            </>
          ) : <p>Workspace not created yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
