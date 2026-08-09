import { useEffect, useState, useSyncExternalStore } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Camera, Link2, MonitorSmartphone, RefreshCw, Trash2 } from 'lucide-react';
import { useRegistry } from '@/hooks/useRegistry';
import {
  bridgePermissions, generatePairCode, getEndpoint, getPairToken, pairDevice,
  pairedDevices, permissionStatus, pingBridge, setEndpoint, setPairToken, setPermission,
  type BridgeHealth,
} from '@/services/os/desktopBridge';
import { localPermissionAudit, subscribePermissionAudit } from '@/services/os/permissionAudit';
import { getBridgeMonitorState, retryBridgeNow, startBridgeMonitor, subscribeBridgeMonitor } from '@/services/os/bridgeMonitor';
import {
  getDevices, heartbeat, subscribeDevices, deviceId, isTrustedLocally,
  trustThisDevice, revokeDevice, restoreDevice,
} from '@/services/os/deviceRegistry';
import { discoverOllama, getOllamaState, subscribeOllama, getOllamaHost, setOllamaHost } from '@/services/os/ollama';
import { listTools } from '@/services/os/toolRouter';
import { captureScreen } from '@/services/os/vision';
import BridgeInstallCard from './BridgeInstallCard';

function auditCsv(rows: { at: string; capability: string; action: string; allowed: boolean; reason?: string; source?: string }[]) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['timestamp', 'capability', 'action', 'permission', 'source', 'reason'].join(',');
  const body = rows.map((r) => [r.at, r.capability, r.action, r.allowed ? 'allowed' : 'blocked', r.source || '', r.reason || ''].map(esc).join(','));
  return [head, ...body].join('\n');
}

export default function DesktopBridgePanel() {
  const permissions = useRegistry(bridgePermissions);
  const devices = useRegistry(pairedDevices);
  const [health, setHealth] = useState<BridgeHealth | null>(null);
  const [endpoint, setEndpointState] = useState(getEndpoint());
  const [token, setTokenState] = useState(getPairToken());
  const [pairCode, setPairCode] = useState('');
  const [shot, setShot] = useState<string | null>(null);
  const [audit, setAudit] = useState(localPermissionAudit());
  const monitor = useSyncExternalStore(subscribeBridgeMonitor, getBridgeMonitorState, getBridgeMonitorState);
  const cloudDevices = useSyncExternalStore(subscribeDevices, getDevices, getDevices);
  const ollama = useSyncExternalStore(subscribeOllama, getOllamaState, getOllamaState);
  const [ollamaHost, setOllamaHostState] = useState(getOllamaHost());
  const me = deviceId();

  useEffect(() => subscribePermissionAudit(() => setAudit(localPermissionAudit())), []);
  useEffect(() => { startBridgeMonitor(); }, []);

  const check = async () => setHealth(await pingBridge());

  useEffect(() => {
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, []);

  const saveConnection = () => {
    setEndpoint(endpoint);
    setPairToken(token);
    toast.success('Bridge connection saved');
    check();
  };

  return (
    <div className="space-y-6">
      <BridgeInstallCard />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MonitorSmartphone className="h-4 w-4" /> Desktop Bridge
            <Badge variant={monitor.state === 'connected' ? 'default' : monitor.state === 'stale' ? 'outline' : 'secondary'} className="text-[10px]">
              {monitor.state}
            </Badge>
          </CardTitle>
          <CardDescription>
            The Bridge is an optional local helper that lets TIVO see and control this computer.
            Without it everything else keeps working — only OS control is unavailable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Bridge address</Label>
              <Input value={endpoint} onChange={(e) => setEndpointState(e.target.value)} placeholder="http://127.0.0.1:8791" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pairing token</Label>
              <Input type="password" value={token} onChange={(e) => setTokenState(e.target.value)} placeholder="token from the Bridge app" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={saveConnection}><Link2 className="mr-1.5 h-3.5 w-3.5" /> Save & connect</Button>
            <Button size="sm" variant="outline" onClick={() => { retryBridgeNow(); check(); }}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Check now
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{monitor.message}</p>
          <p className="text-[11px] text-muted-foreground">
            transport: {monitor.transport} · last connected: {monitor.lastConnectedAt ? new Date(monitor.lastConnectedAt).toLocaleString() : 'never'}
            {' '}· last heartbeat: {monitor.lastHeartbeatAt ? new Date(monitor.lastHeartbeatAt).toLocaleTimeString() : '—'}
            {monitor.state !== 'connected' ? ` · retrying in ${Math.round(monitor.nextRetryInMs / 1000)}s (attempt ${monitor.attempts})` : ''}
            {monitor.paused ? ' · retries paused' : ''}
          </p>
          {health && (
            <p className="text-xs text-muted-foreground">
              {health.online
                ? `Bridge ${health.version || ''} on ${health.os || 'this machine'} · ${health.latencyMs}ms`
                : health.error}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permissions</CardTitle>
          <CardDescription>TIVO only performs an action after you switch it on here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {permissions.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{p.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {p.capability} · {permissionStatus(p.capability)}
                  {p.source ? ` · set by ${p.source}` : ''}
                  {p.lastUsedAt ? ` · last used ${new Date(p.lastUsedAt).toLocaleString()}` : ' · never used'}
                </p>
              </div>
              <Input
                className="ml-auto h-8 max-w-[180px] text-xs"
                value={p.scope}
                onChange={(e) => bridgePermissions.update(p.id, { scope: e.target.value })}
              />
              <Switch checked={p.granted} onCheckedChange={(v) => setPermission(p.capability, v, p.scope)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Permission audit</CardTitle>
            <CardDescription>Everything TIVO tried to access — what, when, why and whether it was allowed.</CardDescription>
          </div>
          <Button size="sm" variant="outline" disabled={!audit.length} onClick={() => {
            const url = URL.createObjectURL(new Blob([auditCsv(audit)], { type: 'text/csv' }));
            const a = document.createElement('a');
            a.href = url; a.download = `tivo-permission-audit-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click(); URL.revokeObjectURL(url);
          }}>Export CSV</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {audit.length === 0 && <p className="text-xs text-muted-foreground">Nothing has been accessed yet.</p>}
          {audit.slice(0, 25).map((a, i) => (
            <div key={`${a.at}-${i}`} className="rounded-lg border border-border p-2">
              <p className="text-xs font-medium">
                {a.allowed ? 'Allowed' : 'Blocked'} · {a.capability} · {a.action}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {new Date(a.at).toLocaleString()}{a.reason ? ` — ${a.reason}` : ''}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Camera className="h-4 w-4" /> Screen vision</CardTitle>
          <CardDescription>Uses the Bridge when available, otherwise asks the browser to share a window.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button size="sm" variant="outline" onClick={() => captureScreen()
            .then((s) => { setShot(s.dataUrl); toast.success(`Screen captured via ${s.source}`); })
            .catch((e) => toast.error(e instanceof Error ? e.message : 'Capture failed'))}>
            Capture screen
          </Button>
          {shot && <img src={shot} alt="Captured screen preview" className="max-h-64 rounded-lg border border-border" />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paired devices</CardTitle>
          <CardDescription>Pair a phone or another computer so TIVO can reach its Bridge.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPairCode(generatePairCode())}>Generate pair code</Button>
            {pairCode && <code className="rounded bg-muted px-2 py-1 text-sm tracking-widest">{pairCode}</code>}
            <Button size="sm" disabled={!pairCode} onClick={() => {
              pairDevice(navigator.platform || 'Device', navigator.platform || 'unknown', endpoint, token || pairCode);
              toast.success('Device paired');
              setPairCode('');
            }}>Pair this device</Button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium">Devices on this account</p>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { void heartbeat(); }}>Refresh</Button>
            </div>
            {cloudDevices.length === 0 && <p className="text-xs text-muted-foreground">No devices have reported in yet.</p>}
            {cloudDevices.map((d) => (
              <div key={d.device_id} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">
                  {d.name} <Badge variant={d.online ? 'default' : 'secondary'} className="ml-1 text-[10px]">{d.online ? 'online' : 'offline'}</Badge>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {d.platform || 'unknown'} · {d.role} · health {d.health} · last seen {new Date(d.last_heartbeat).toLocaleString()}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  ready: {(d.capabilities || []).filter((c) => c.state === 'ready').map((c) => c.label).join(', ') || 'none reported'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  local models: {(d.models || []).filter((m) => m.status === 'ready').map((m) => m.name).join(', ') || 'none installed'}
                </p>
              </div>
            ))}
          </div>
          {devices.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
              <span className="font-medium">{d.name}</span>
              <span className="text-[11px] text-muted-foreground">{d.endpoint}</span>
              <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => pairedDevices.remove(d.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {devices.length === 0 && <p className="text-sm text-muted-foreground">No paired devices yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}