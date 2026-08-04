import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Download, Plus, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { useRegistry } from '@/hooks/useRegistry';
import {
  CONSTITUTION_SECTIONS, buildSystemPrompt, constitution, upsertEntry,
  type ConstitutionSection,
} from '@/services/os/constitution';

const EMPTY = { id: '', section: 'rules' as ConstitutionSection, title: '', content: '', priority: 50, tags: '' };

export default function ConstitutionPanel() {
  const entries = useRegistry(constitution);
  const [filter, setFilter] = useState<'all' | ConstitutionSection>('all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(EMPTY);
  const [showPrompt, setShowPrompt] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => filter === 'all' || e.section === filter)
      .filter((e) => !q || e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q))
      .sort((a, b) => a.section.localeCompare(b.section) || a.priority - b.priority);
  }, [entries, filter, query]);

  const save = () => {
    if (!draft.title.trim() || !draft.content.trim()) return toast.error('Title and content are required');
    upsertEntry({
      id: draft.id || undefined,
      section: draft.section,
      title: draft.title.trim(),
      content: draft.content.trim(),
      priority: Number(draft.priority) || 50,
      tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    setDraft(EMPTY);
    toast.success('Saved — this applies to the very next message');
  };

  const exportAll = () => {
    const blob = new Blob([constitution.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tivo-constitution.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importAll = async (file?: File) => {
    if (!file) return;
    try {
      const n = constitution.importJson(await file.text(), 'merge');
      toast.success(`${n} entries imported`);
    } catch {
      toast.error('That file is not a valid constitution export');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Constitution</CardTitle>
          <CardDescription>
            Identity, rules, knowledge, behaviour, prompts, memory and safety policies. Every edit is live — no restart, no redeploy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Section</Label>
              <Select value={draft.section} onValueChange={(v) => setDraft({ ...draft, section: v as ConstitutionSection })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONSTITUTION_SECTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Title / variable name</Label>
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Priority (lower = earlier)</Label>
              <Input type="number" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tags (comma separated)</Label>
              <Input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Content — supports {'{{variable}}'} placeholders</Label>
            <Textarea rows={4} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={save}>
              {draft.id ? <><Save className="mr-1.5 h-3.5 w-3.5" /> Update</> : <><Plus className="mr-1.5 h-3.5 w-3.5" /> Add entry</>}
            </Button>
            {draft.id && <Button size="sm" variant="ghost" onClick={() => setDraft(EMPTY)}>Cancel</Button>}
            <Button size="sm" variant="outline" onClick={exportAll}><Download className="mr-1.5 h-3.5 w-3.5" /> Export</Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-1.5 h-3.5 w-3.5" /> Import</Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => importAll(e.target.files?.[0])} />
            <Button size="sm" variant="ghost" onClick={() => { constitution.reset(); toast.success('Restored the default constitution'); }}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
            </Button>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setShowPrompt((v) => !v)}>
              {showPrompt ? 'Hide' : 'Preview'} live prompt
            </Button>
          </div>
          {showPrompt && (
            <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 text-[11px] whitespace-pre-wrap">
              {buildSystemPrompt()}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Entries ({visible.length})</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-xs" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <Select value={filter} onValueChange={(v) => setFilter(v as 'all' | ConstitutionSection)}>
              <SelectTrigger className="max-w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections</SelectItem>
                {CONSTITUTION_SECTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {visible.map((e) => (
            <div key={e.id} className="rounded-lg border border-border p-3 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{e.section}</Badge>
                <span className="text-sm font-medium">{e.title}</span>
                <span className="text-[11px] text-muted-foreground">p{e.priority}</span>
                <div className="ml-auto flex items-center gap-2">
                  <Switch checked={e.enabled} onCheckedChange={(v) => constitution.update(e.id, { enabled: v })} />
                  <Button size="sm" variant="ghost" onClick={() => setDraft({
                    id: e.id, section: e.section, title: e.title, content: e.content,
                    priority: e.priority, tags: e.tags.join(', '),
                  })}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => constitution.remove(e.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{e.content}</p>
            </div>
          ))}
          {visible.length === 0 && <p className="text-sm text-muted-foreground">Nothing matches.</p>}
        </CardContent>
      </Card>
    </div>
  );
}