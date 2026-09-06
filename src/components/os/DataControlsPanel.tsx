import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DATA_RULES, clearDataGroup, runAutomaticCleanup, storageUsage, type StorageUsage } from '@/services/os/dataLifecycle';

const CATEGORY_LABEL: Record<string, string> = {
  permanent: 'Permanent',
  'user-controlled': 'You decide',
  expirable: 'Auto-expires',
  temporary: 'Temporary',
};

function formatBytes(n: number) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function DataControlsPanel() {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => { void storageUsage().then(setUsage).catch(() => {}); };
  useEffect(refresh, []);

  const confirmClear = async () => {
    if (!pending) return;
    setBusy(true);
    const ok = await clearDataGroup(pending);
    setBusy(false);
    setPending(null);
    toast[ok ? 'success' : 'error'](ok ? 'Cleared' : 'Could not clear this group');
    refresh();
  };

  const runCleanup = async () => {
    setBusy(true);
    await runAutomaticCleanup(true).catch(() => []);
    setBusy(false);
    toast.success('Maintenance finished');
    refresh();
  };

  const pendingRule = DATA_RULES.find((r) => r.id === pending);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Storage on this device</CardTitle>
          <CardDescription>
            {usage
              ? `${formatBytes(usage.usedBytes)} used of ${formatBytes(usage.quotaBytes)}${usage.persisted ? ' · protected from automatic eviction' : ''}`
              : 'Checking…'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" variant="outline" onClick={runCleanup} disabled={busy}>
            Run maintenance now
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your data</CardTitle>
          <CardDescription>Projects, memory and settings are never removed automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {DATA_RULES.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{rule.label}</p>
                <p className="text-xs text-muted-foreground">
                  {rule.retentionDays ? `Kept for ${rule.retentionDays} days` : 'Kept until you remove it'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{CATEGORY_LABEL[rule.category]}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setPending(rule.id)} disabled={busy}>
                  Clear
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(pending)} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear “{pendingRule?.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes that data from this device permanently and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClear}>Clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
