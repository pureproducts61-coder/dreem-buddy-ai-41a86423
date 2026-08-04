import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Cpu, Download, HardDrive, RefreshCw, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { useRegistry } from '@/hooks/useRegistry';
import {
  autoDetectModels, cancelDownload, detectHardware, downloadModel, formatBytes,
  getCatalog, importModelFile, modelRegistry, recommendModels, registerModel,
  removeModel, setDefaultModel, storageUsage, verifyModel,
  type HardwareProfile, type ModelSuggestion,
} from '@/services/os/modelManager';

export default function LocalModelsPanel() {
  const models = useRegistry(modelRegistry);
  const [hw, setHw] = useState<HardwareProfile | null>(null);
  const [suggestions, setSuggestions] = useState<ModelSuggestion[]>([]);
  const [custom, setCustom] = useState({ name: '', url: '', checksum: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    detectHardware().then((profile) => {
      setHw(profile);
      setSuggestions(recommendModels(profile));
    });
    autoDetectModels();
  }, []);

  const usage = storageUsage();

  const addSuggestion = (s: ModelSuggestion) => {
    registerModel({ name: s.name, family: s.family, params: s.params, quant: s.quant, url: s.url, sizeBytes: s.sizeBytes });
    toast.success(`${s.name} added to your model list`);
  };

  const addCustom = () => {
    if (!custom.name.trim()) return toast.error('Give the model a name');
    registerModel({ name: custom.name.trim(), url: custom.url.trim(), checksum: custom.checksum.trim() || undefined });
    setCustom({ name: '', url: '', checksum: '' });
    toast.success('Model registered');
  };

  const onImport = async (file?: File) => {
    if (!file) return;
    toast.info(`Importing ${file.name}…`);
    try {
      await importModelFile(file);
      toast.success('Model imported and stored on this device');
    } catch {
      toast.error('Could not import that file');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Cpu className="h-4 w-4" /> This device</CardTitle>
          <CardDescription>Hardware is detected automatically and drives the recommendations below.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
          <Stat label="Type" value={hw ? (hw.isMobile ? 'Mobile' : 'Desktop') : '…'} />
          <Stat label="CPU cores" value={hw ? String(hw.cores) : '…'} />
          <Stat label="Memory" value={hw ? `~${hw.ramGb} GB` : '…'} />
          <Stat label="Free storage" value={hw ? `${Math.max(0, hw.storageQuotaGb - hw.storageUsedGb).toFixed(1)} GB` : '…'} />
          <Stat label="GPU" value={hw?.gpu?.slice(0, 28) || 'unknown'} />
          <Stat label="Models stored" value={`${usage.count}`} />
          <Stat label="Model storage" value={formatBytes(usage.totalBytes)} />
          <div className="flex items-end">
            <Button size="sm" variant="outline" onClick={async () => {
              const n = await autoDetectModels();
              toast.success(n ? `${n} local model(s) re-attached` : 'No new local models found');
            }}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Rescan
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recommended for this hardware</CardTitle>
          <CardDescription>Suggestions only — you can add any model you want.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {suggestions.length === 0 && <p className="text-sm text-muted-foreground">Detecting…</p>}
          {suggestions.map((s) => (
            <Button key={s.name} size="sm" variant="secondary" onClick={() => addSuggestion(s)}>
              {s.name} · {s.quant || s.params} · {formatBytes(s.sizeBytes)}
            </Button>
          ))}
          {getCatalog().length > suggestions.length && (
            <Button size="sm" variant="ghost" onClick={() => setSuggestions(getCatalog())}>Show all</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a model</CardTitle>
          <CardDescription>Download from a URL or import a GGUF file already on this device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="My model" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Download URL (optional)</Label>
              <Input value={custom.url} onChange={(e) => setCustom({ ...custom, url: e.target.value })} placeholder="https://…/model.gguf" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">SHA-256 (optional)</Label>
              <Input value={custom.checksum} onChange={(e) => setCustom({ ...custom, checksum: e.target.value })} placeholder="for integrity check" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={addCustom}>Register model</Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Import GGUF file
            </Button>
            <input ref={fileRef} type="file" accept=".gguf,.bin,.safetensors" className="hidden"
              onChange={(e) => onImport(e.target.files?.[0])} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><HardDrive className="h-4 w-4" /> Installed models</CardTitle>
          <CardDescription>Weights are stored offline on this device. Nothing is hardcoded — this list is fully dynamic.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {models.length === 0 && <p className="text-sm text-muted-foreground">No models yet. Add one above.</p>}
          {models.map((m) => {
            const pct = m.sizeBytes ? Math.min(100, (m.bytesDownloaded / m.sizeBytes) * 100) : 0;
            return (
              <div key={m.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">{m.name}</span>
                  <Badge variant="outline" className="text-[10px]">{m.family}</Badge>
                  {m.quant && <Badge variant="outline" className="text-[10px]">{m.quant}</Badge>}
                  <Badge variant={m.status === 'ready' ? 'default' : m.status === 'error' ? 'destructive' : 'secondary'} className="text-[10px]">
                    {m.status}
                  </Badge>
                  {m.isDefault && <Badge className="text-[10px]">default</Badge>}
                  {m.verified && <Badge variant="outline" className="text-[10px]">verified</Badge>}
                  <span className="ml-auto text-xs text-muted-foreground">{formatBytes(m.sizeBytes)}</span>
                </div>

                {m.status === 'downloading' && (
                  <div className="space-y-1">
                    <Progress value={pct} className="h-1.5" />
                    <p className="text-[11px] text-muted-foreground">
                      Downloading {formatBytes(m.bytesDownloaded)} of {formatBytes(m.sizeBytes)} ({pct.toFixed(0)}%)
                    </p>
                  </div>
                )}
                {m.error && <p className="text-[11px] text-destructive">{m.error}</p>}

                <div className="flex flex-wrap items-center gap-2">
                  {m.status === 'downloading' ? (
                    <Button size="sm" variant="outline" onClick={() => cancelDownload(m.id)}>
                      <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={!m.url}
                      onClick={() => downloadModel(m.id).then(() => toast.success(`${m.name} is ready offline`))
                        .catch((e) => toast.error(e instanceof Error ? e.message : 'Download failed'))}>
                      <Download className="mr-1.5 h-3.5 w-3.5" /> {m.status === 'ready' ? 'Re-download' : 'Download'}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => verifyModel(m.id).then((r) => r.ok ? toast.success(r.reason) : toast.error(r.reason))}>
                    <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Verify
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDefaultModel(m.id)} disabled={m.isDefault}>
                    Make default
                  </Button>
                  <div className="flex items-center gap-1.5">
                    <Switch checked={m.enabled} onCheckedChange={(v) => modelRegistry.update(m.id, { enabled: v })} />
                    <span className="text-xs text-muted-foreground">Enabled</span>
                  </div>
                  <Button size="sm" variant="ghost" className="ml-auto text-destructive"
                    onClick={() => removeModel(m.id).then(() => toast.success('Model removed'))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}