import { useEffect, useState } from 'react';
import { Power, ShieldAlert, BellRing } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getKillSwitch, setKillSwitch, subscribeKillSwitch, type KillSwitchState } from '@/services/killSwitchService';
import { ensureNotificationPermission, startAdminPushListener, stopAdminPushListener, isPushEnabledPref, setPushEnabledPref } from '@/services/pushNotificationService';

export function KillSwitchPanel() {
  const { toast } = useToast();
  const [state, setState] = useState<KillSwitchState>(getKillSwitch());
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [pushPerm, setPushPerm] = useState<NotificationPermission>('default');
  const [pushPref, setPushPref] = useState<boolean>(isPushEnabledPref());

  useEffect(() => {
    const unsub = subscribeKillSwitch(setState);
    if ('Notification' in window) setPushPerm(Notification.permission);
    return unsub;
  }, []);

  const toggle = async (next: boolean) => {
    setBusy(true);
    try {
      await setKillSwitch(next, next ? (reason || 'Admin halted autonomous tasks') : undefined);
      toast({
        title: next ? '🛑 Kill-switch ENGAGED' : '✅ Kill-switch released',
        description: next ? 'All autonomous tasks are now blocked.' : 'Operations resumed.',
        variant: next ? 'destructive' : 'default',
      });
    } catch (e) {
      toast({ title: 'Error', description: String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const enablePush = async () => {
    if (!pushPref) {
      setPushEnabledPref(true);
      setPushPref(true);
    }
    const perm = await ensureNotificationPermission();
    setPushPerm(perm);
    if (perm === 'granted') {
      await startAdminPushListener();
      toast({ title: '🔔 Push notifications enabled' });
    } else {
      toast({ title: 'Permission denied', variant: 'destructive' });
    }
  };

  const togglePref = (on: boolean) => {
    setPushEnabledPref(on);
    setPushPref(on);
    if (!on) {
      stopAdminPushListener();
      toast({ title: '🔕 Notifications muted' });
    } else if (pushPerm === 'granted') {
      startAdminPushListener();
      toast({ title: '🔔 Notifications resumed' });
    }
  };

  return (
    <Card className={state.kill_switch ? 'border-destructive/50 bg-destructive/5' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className={`h-5 w-5 ${state.kill_switch ? 'text-destructive' : 'text-primary'}`} />
          Admin Kill-Switch & Push Alerts
        </CardTitle>
        <CardDescription>
          Hard-stop every autonomous task across the system, and route all inbox / approval events to your device as desktop notifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <Power className={`h-5 w-5 ${state.kill_switch ? 'text-destructive' : 'text-emerald-500'}`} />
            <div>
              <p className="text-sm font-semibold">{state.kill_switch ? 'STOPPED' : 'RUNNING'}</p>
              <p className="text-[11px] text-muted-foreground">
                {state.kill_switch ? state.reason || 'All autonomous actions blocked.' : 'Orchestration active.'}
              </p>
            </div>
          </div>
          <Switch checked={state.kill_switch} disabled={busy} onCheckedChange={toggle} />
        </div>

        {!state.kill_switch && (
          <Input
            placeholder="Reason (optional, shown to user when blocked)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="text-sm"
          />
        )}

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <BellRing className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">Desktop push notifications</p>
              <p className="text-[11px] text-muted-foreground">
                Permission: <span className="font-mono">{pushPerm}</span> · Pref: <span className="font-mono">{pushPref ? 'on' : 'muted'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={pushPref} onCheckedChange={togglePref} />
            <Button size="sm" variant={pushPerm === 'granted' ? 'outline' : 'default'} onClick={enablePush}>
              {pushPerm === 'granted' ? 'Re-arm' : 'Enable'}
            </Button>
          </div>
        </div>

        {state.kill_switch && (
          <Button variant="destructive" className="w-full" onClick={() => toggle(false)} disabled={busy}>
            Release kill-switch & resume operations
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
