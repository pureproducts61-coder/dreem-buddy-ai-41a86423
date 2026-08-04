import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { useRegistry } from '@/hooks/useRegistry';
import { addPlugin, pluginRegistry, type OsPlugin } from '@/services/os/plugins';

const EMPTY = { name: '', description: '', kind: 'tool' as OsPlugin['kind'], entry: '', requiresBridge: false };

export default function PluginsPanel() {
  const plugins = useRegistry(pluginRegistry);
  const [draft, setDraft] = useState(EMPTY);

  const add = () => {
    if (!draft.name.trim()) return toast.error('Give the plugin a name');
    addPlugin({ ...draft, name: draft.name.trim(), enabled: true, config: {} });
    setDraft(EMPTY);
    toast.success('Plugin registered');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Plugins & skills</CardTitle>
        <CardDescription>Add new abilities without changing code. Enabled plugins are advertised to the AI automatically.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Kind</Label>
            <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v as OsPlugin['kind'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['tool', 'skill', 'connector', 'automation'].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Entry (URL / bridge action)</Label>
            <Input value={draft.entry} onChange={(e) => setDraft({ ...draft, entry: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={draft.requiresBridge} onCheckedChange={(v) => setDraft({ ...draft, requiresBridge: v })} />
          <span className="text-xs text-muted-foreground">Needs the Desktop Bridge</span>
          <Button size="sm" className="ml-auto" onClick={add}><Plus className="mr-1.5 h-3.5 w-3.5" /> Add plugin</Button>
        </div>

        <div className="space-y-2">
          {plugins.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{p.name} <Badge variant="outline" className="ml-1 text-[10px]">{p.kind}</Badge></p>
                <p className="text-[11px] text-muted-foreground truncate">{p.description || p.entry}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Switch checked={p.enabled} onCheckedChange={(v) => pluginRegistry.update(p.id, { enabled: v })} />
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => pluginRegistry.remove(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {plugins.length === 0 && <p className="text-sm text-muted-foreground">No plugins yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}