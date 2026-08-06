import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Download, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  checkBridgeStatus, installBridge, updateBridge, getManifestUrl, setManifestUrl,
  type BridgeStatus, type InstallStep,
} from '@/services/os/bridgeInstaller';

export default function BridgeInstallCard() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [steps, setSteps] = useState<InstallStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [manifest, setManifest] = useState(getManifestUrl());

  const refresh = () => checkBridgeStatus().then(setStatus).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const install = async () => {
    setBusy(true);
    setSteps([]);
    try {
      const ok = await installBridge(setSteps);
      toast[ok ? 'success' : 'error'](ok ? 'Desktop Bridge is ready' : 'Bridge setup did not finish');
      refresh();
    } finally { setBusy(false); }
  };

  const online = status?.health.online;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Download className="h-4 w-4" /> Bridge setup
          <Badge variant={online ? 'default' : 'secondary'} className="text-[10px]">
            {online ? `installed ${status?.installedVersion || ''}` : 'not installed'}
          </Badge>
        </CardTitle>
        <CardDescription>
          One button installs the Bridge, registers it as a local service that starts with the computer,
          pairs it with this account and verifies it. Updates then arrive automatically — you never reinstall.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={install} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
            {online ? 'Repair / re-run setup' : 'Install Desktop Bridge'}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
            const res = await updateBridge();
            toast[res.updated ? 'success' : 'info'](res.message);
            refresh();
          }}>Check for Bridge update</Button>
        </div>

        {status?.updateAvailable && (
          <p className="text-xs text-primary">Bridge {status.latest?.version} is available (you have {status.installedVersion}).</p>
        )}

        {steps.length > 0 && (
          <div className="space-y-1.5" aria-live="polite">
            {steps.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                {s.status === 'running' ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : s.status === 'done' ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  : s.status === 'failed' ? <XCircle className="h-3.5 w-3.5 text-destructive" />
                  : <span className="h-3.5 w-3.5 rounded-full border border-border" />}
                <span className={s.status === 'pending' ? 'text-muted-foreground' : ''}>{s.label}</span>
                {s.detail && <span className="text-muted-foreground">— {s.detail}</span>}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Bridge release manifest</Label>
          <div className="flex gap-2">
            <Input value={manifest} onChange={(e) => setManifest(e.target.value)} className="text-xs" />
            <Button size="sm" variant="outline" onClick={() => { setManifestUrl(manifest); refresh(); toast.success('Manifest saved'); }}>Save</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Platform detected: {status?.platform || '…'}{status?.installerUrl ? ' · installer available' : ' · no installer published yet'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
