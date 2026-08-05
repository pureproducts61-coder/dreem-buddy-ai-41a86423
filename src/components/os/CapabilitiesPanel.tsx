import { useEffect, useState, useSyncExternalStore } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { detectCapabilities, getCapabilities, subscribeCapabilities, type CapabilityState } from '@/services/os/capabilities';

const TONE: Record<CapabilityState, string> = {
  ready: 'default', unavailable: 'destructive', 'permission-required': 'secondary',
  'plugin-required': 'outline', disabled: 'outline',
};

export default function CapabilitiesPanel() {
  const caps = useSyncExternalStore(subscribeCapabilities, getCapabilities, getCapabilities);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    detectCapabilities();
    const t = setInterval(() => detectCapabilities(), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">AI capabilities</CardTitle>
          <CardDescription>Detected automatically. The AI only claims what is ready here.</CardDescription>
        </div>
        <Button size="sm" variant="outline" disabled={busy}
          onClick={async () => { setBusy(true); await detectCapabilities(); setBusy(false); }}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Re-detect
        </Button>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2" aria-live="polite">
        {caps.map((c) => (
          <div key={c.id} className="rounded-lg border border-border p-3">
            <p className="text-sm font-medium">
              {c.label} <Badge variant={TONE[c.state] as 'default'} className="ml-1 text-[10px]">{c.state}</Badge>
            </p>
            <p className="text-[11px] text-muted-foreground">{c.detail}</p>
            <p className="text-[10px] text-muted-foreground">
              health: {c.health} · last used: {c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleString() : 'never'}
            </p>
          </div>
        ))}
        {caps.length === 0 && <p className="text-sm text-muted-foreground">Detecting…</p>}
      </CardContent>
    </Card>
  );
}