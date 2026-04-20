import { useEffect, useState } from 'react';
import { Database, AlertTriangle, CheckCircle2, Eye, EyeOff, Play, ArrowRightLeft, Power } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  getCustomDbConfig, isUsingCustomDb, setUseCustomDb,
  setupCustomDb, migrateDataToCustomDb,
} from '@/services/customSupabaseService';

export function CustomDbTab() {
  const { toast } = useToast();
  const cfg = getCustomDbConfig();
  const [usingCustom, setUsingCustom] = useState(isUsingCustomDb());
  const [serviceKey, setServiceKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState<'setup' | 'migrate' | null>(null);
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string; stats?: Record<string, number> } | null>(null);

  useEffect(() => { setUsingCustom(isUsingCustomDb()); }, []);

  const handleToggle = (v: boolean) => {
    setUseCustomDb(v);
    setUsingCustom(v);
    toast({ title: v ? 'Switched to custom DB' : 'Switched to default DB', description: 'Reload the page for the change to fully take effect.' });
  };

  const handleAction = async (action: 'setup' | 'migrate') => {
    if (!serviceKey.trim()) {
      toast({ title: 'Service-role key required', variant: 'destructive' });
      return;
    }
    setBusy(action);
    setLastResult(null);
    try {
      const fn = action === 'setup' ? setupCustomDb : migrateDataToCustomDb;
      const res = await fn(serviceKey.trim());
      setLastResult(res);
      toast({
        title: res.ok ? 'Success' : 'Failed',
        description: res.message,
        variant: res.ok ? 'default' : 'destructive',
      });
      // Wipe key from memory after use
      if (res.ok) setServiceKey('');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Detection card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Custom Supabase Detection</CardTitle>
          <CardDescription>
            TIVO automatically detects custom Supabase env vars set in your hosting (e.g. Vercel)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <DetectionRow label="VITE_CUSTOM_SUPABASE_URL" value={cfg?.url} />
          <DetectionRow label="VITE_CUSTOM_SUPABASE_ANON_KEY" value={cfg?.anonKey} masked />
          {!cfg && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-orange-500/30 bg-orange-500/5 text-orange-500">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold mb-1">No custom Supabase detected</p>
                <p className="text-muted-foreground">
                  Add <code className="font-mono">VITE_CUSTOM_SUPABASE_URL</code> and{' '}
                  <code className="font-mono">VITE_CUSTOM_SUPABASE_ANON_KEY</code> to your Vercel
                  environment variables and redeploy. The service-role key is requested on demand below
                  and is never stored in the browser.
                </p>
              </div>
            </div>
          )}
          {cfg && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-3">
                <Power className={`h-4 w-4 ${usingCustom ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-sm font-medium">{usingCustom ? 'Using custom DB' : 'Using default DB'}</p>
                  <p className="text-[11px] text-muted-foreground">Toggle to switch the active connection</p>
                </div>
              </div>
              <Switch checked={usingCustom} onCheckedChange={handleToggle} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup / Migrate card */}
      {cfg && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              Schema setup & data migration
            </CardTitle>
            <CardDescription>
              Service-role key is sent once to the edge function, used for the operation, and not stored anywhere.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Service-role key (one-time)</Label>
              <div className="relative">
                <Input type={showKey ? 'text' : 'password'} value={serviceKey}
                  onChange={(e) => setServiceKey(e.target.value)}
                  placeholder="eyJhbGc... (from your custom Supabase → Settings → API)"
                  className="pr-10 font-mono text-xs" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowKey(s => !s)}>
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button onClick={() => handleAction('setup')} disabled={busy !== null || !serviceKey.trim()} variant="outline">
                <Play className="h-3.5 w-3.5 mr-1.5" />
                {busy === 'setup' ? 'Setting up...' : '1. Create schema'}
              </Button>
              <Button onClick={() => handleAction('migrate')} disabled={busy !== null || !serviceKey.trim()}>
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
                {busy === 'migrate' ? 'Migrating...' : '2. Migrate data'}
              </Button>
            </div>

            {lastResult && (
              <>
                <Separator />
                <div className={`rounded-lg border p-3 ${
                  lastResult.ok ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-destructive/30 bg-destructive/5'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {lastResult.ok
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <AlertTriangle className="h-4 w-4 text-destructive" />}
                    <p className="text-sm font-medium">{lastResult.message}</p>
                  </div>
                  {lastResult.stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                      {Object.entries(lastResult.stats).map(([t, c]) => (
                        <div key={t} className="text-[11px] flex justify-between p-1.5 rounded bg-background/40">
                          <span className="font-mono text-muted-foreground">{t}</span>
                          <Badge variant="outline" className="text-[10px]">{c}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DetectionRow({ label, value, masked }: { label: string; value?: string; masked?: boolean }) {
  const ok = !!value;
  const display = !value ? '—' : masked ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 bg-card/50">
      <div className="min-w-0">
        <p className="text-[10px] font-mono text-muted-foreground">{label}</p>
        <p className="text-xs font-mono truncate">{display}</p>
      </div>
      <Badge variant="outline" className={ok ? 'border-primary/30 text-primary' : 'border-muted-foreground/30 text-muted-foreground'}>
        {ok ? 'Detected' : 'Not set'}
      </Badge>
    </div>
  );
}
