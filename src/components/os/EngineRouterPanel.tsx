import { useEffect, useState, useSyncExternalStore } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RefreshCw } from 'lucide-react';
import { useRegistry } from '@/hooks/useRegistry';
import {
  engineRegistry, orderedEngines, refreshEngineStatuses, subscribeEngines,
  getActiveEngineId, finalFallbackEngine,
} from '@/services/os/engineRouter';
import {
  getRuntimeStatus, subscribeRuntime, activateModel, deactivateModel,
  unloadModel, autoStartRuntime, recoverRuntime,
} from '@/services/os/localRuntime';
import { modelRegistry, formatBytes, getDefaultModel } from '@/services/os/modelManager';

export default function EngineRouterPanel() {
  const engines = useRegistry(engineRegistry);
  const models = useRegistry(modelRegistry);
  const runtime = useSyncExternalStore(subscribeRuntime, getRuntimeStatus, getRuntimeStatus);
  const activeId = useSyncExternalStore(subscribeEngines, getActiveEngineId, getActiveEngineId);
  const [online, setOnline] = useState(navigator.onLine);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refreshEngineStatuses();
    autoStartRuntime();
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const timer = setInterval(() => refreshEngineStatuses(), 20000);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearInterval(timer); };
  }, []);

  const ordered = orderedEngines();
  const active = engines.find((e) => e.id === activeId) || ordered.find((e) => e.lastStatus === 'ready');
  const def = getDefaultModel();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">AI Engine</CardTitle>
            <CardDescription>Local first, Lovable AI Gateway always last.</CardDescription>
          </div>
          <Button size="sm" variant="outline" disabled={busy} onClick={async () => { setBusy(true); await refreshEngineStatuses(); setBusy(false); }}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Stat label="Active engine" value={active?.name || 'None yet'} />
          <Stat label="Default model" value={def?.name || 'Not set'} />
          <Stat label="Fallback engine" value={finalFallbackEngine()?.name || 'None'} />
          <Stat label="Runtime status" value={`${runtime.state} — ${runtime.message}`} />
          <Stat label="Inference" value={runtime.state === 'inferring' ? 'Running now' : runtime.lastInferenceMs ? `Last took ${runtime.lastInferenceMs} ms` : 'Idle'} />
          <Stat label="Offline status" value={online ? 'Online' : 'Offline — local engines only'} />
          <Stat label="Memory used" value={formatBytes(runtime.memoryBytes)} />
          <Stat label="Auto recoveries" value={String(runtime.recoveries)} />
          <Stat label="Last error" value={runtime.lastError || 'None'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Engine priority</CardTitle>
          <CardDescription>Lower number runs first. The final fallback always stays last.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {ordered.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {e.name}{' '}
                  <Badge variant={e.lastStatus === 'ready' ? 'default' : 'outline'} className="ml-1 text-[10px]">{e.lastStatus}</Badge>
                  {e.isFinalFallback && <Badge variant="secondary" className="ml-1 text-[10px]">final fallback</Badge>}
                </p>
                <p className="text-[11px] text-muted-foreground">{e.lastError || e.kind}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Input
                  className="h-8 w-16" type="number" value={e.priority}
                  aria-label={`${e.name} priority`}
                  onChange={(ev) => engineRegistry.update(e.id, { priority: Number(ev.target.value) || 1 })}
                />
                {e.kind === 'local-api' && (
                  <Input
                    className="h-8 w-56" value={e.baseUrl} aria-label={`${e.name} base URL`}
                    onChange={(ev) => engineRegistry.update(e.id, { baseUrl: ev.target.value })}
                  />
                )}
                <Switch
                  checked={e.enabled} aria-label={`Enable ${e.name}`}
                  disabled={e.isFinalFallback}
                  onCheckedChange={(v) => engineRegistry.update(e.id, { enabled: v })}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Local model runtime</CardTitle>
          <CardDescription>Only one model is active at a time.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {models.length === 0 && <p className="text-sm text-muted-foreground">No local models registered yet.</p>}
          {models.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{m.name} {m.isDefault && <Badge className="ml-1 text-[10px]">active</Badge>}</p>
                <p className="text-[11px] text-muted-foreground">{m.status} · {formatBytes(m.sizeBytes)}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={busy || m.status !== 'ready'}
                  onClick={async () => { setBusy(true); await activateModel(m.id); await refreshEngineStatuses(); setBusy(false); }}>
                  Activate
                </Button>
                <Button size="sm" variant="ghost" disabled={busy}
                  onClick={async () => { setBusy(true); await deactivateModel(m.id); await refreshEngineStatuses(); setBusy(false); }}>
                  Deactivate
                </Button>
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => unloadModel()}>Unload</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={async () => { setBusy(true); await recoverRuntime(); setBusy(false); }}>Restart runtime</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3" aria-live="polite">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value}</p>
    </div>
  );
}