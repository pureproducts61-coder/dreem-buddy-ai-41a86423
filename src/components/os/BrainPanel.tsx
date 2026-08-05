import { useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, Upload, RotateCcw } from 'lucide-react';
import { useRegistry } from '@/hooks/useRegistry';
import { brainRegistry, resetBrain } from '@/services/os/brain';

export default function BrainPanel() {
  const modules = useRegistry(brainRegistry).slice().sort((a, b) => a.priority - b.priority);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const blob = new Blob([brainRegistry.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tivo-brain.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File) => {
    try {
      const n = brainRegistry.importJson(await file.text(), 'merge');
      toast.success(`${n} brain modules imported`);
    } catch {
      toast.error('That file is not a valid brain export');
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 gap-2">
        <div>
          <CardTitle className="text-base">AI Brain</CardTitle>
          <CardDescription>Every module is editable and applies to the next AI response immediately.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportJson}><Download className="mr-1.5 h-3.5 w-3.5" />Export</Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-1.5 h-3.5 w-3.5" />Import</Button>
          <Button size="sm" variant="ghost" onClick={() => { resetBrain(); toast.success('Brain reset to defaults'); }}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reset
          </Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {modules.map((m) => (
          <div key={m.id} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{m.title} <Badge variant="outline" className="ml-1 text-[10px]">{m.key}</Badge></p>
              <div className="ml-auto flex items-center gap-2">
                <Input className="h-8 w-16" type="number" value={m.priority} aria-label={`${m.title} priority`}
                  onChange={(e) => brainRegistry.update(m.id, { priority: Number(e.target.value) || 1, updatedAt: new Date().toISOString() })} />
                <Switch checked={m.enabled} aria-label={`Enable ${m.title}`}
                  onCheckedChange={(v) => brainRegistry.update(m.id, { enabled: v, updatedAt: new Date().toISOString() })} />
              </div>
            </div>
            <Textarea
              value={m.instructions} rows={3} aria-label={`${m.title} instructions`}
              onChange={(e) => brainRegistry.update(m.id, { instructions: e.target.value, updatedAt: new Date().toISOString() })}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}