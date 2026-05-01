import { useEffect, useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, Save, KeyRound, Loader2, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  listUserSecrets, upsertUserSecret, deleteUserSecret, type UserSecret,
} from '@/services/userSecretsService';

export function UserSecretsManager() {
  const { toast } = useToast();
  const [secrets, setSecrets] = useState<UserSecret[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [showId, setShowId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const load = async () => {
    setLoading(true);
    setSecrets(await listUserSecrets());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name.trim() || !value.trim()) {
      toast({ title: 'Both Key and Value are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await upsertUserSecret(name.trim(), value.trim());
      toast({ title: 'Secret saved' });
      setName(''); setValue('');
      await load();
    } catch (e) {
      toast({ title: 'Failed', description: String(e), variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const saveEdit = async (s: UserSecret) => {
    if (!editValue.trim()) return;
    try {
      await upsertUserSecret(s.name, editValue.trim());
      toast({ title: 'Updated' });
      setEditId(null); setEditValue('');
      load();
    } catch (e) {
      toast({ title: 'Failed', description: String(e), variant: 'destructive' });
    }
  };

  const remove = async (s: UserSecret) => {
    if (!confirm(`Delete secret "${s.name}"?`)) return;
    try {
      await deleteUserSecret(s.id);
      setSecrets(prev => prev.filter(x => x.id !== s.id));
      toast({ title: 'Deleted' });
    } catch (e) {
      toast({ title: 'Failed', description: String(e), variant: 'destructive' });
    }
  };

  const mask = (v: string) => v.length <= 8 ? '••••••••' : v.slice(0, 4) + '••••••' + v.slice(-3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" /> My Secrets
        </CardTitle>
        <CardDescription>
          Save API tokens and keys (e.g. <code>GITHUB_TOKEN</code>, <code>OPENAI_API_KEY</code>).
          The AI can read them to perform actions on your behalf.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new secret */}
        <div className="rounded-xl border border-border/40 bg-card/40 p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px]">Key</Label>
              <Input value={name} onChange={(e) => setName(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                placeholder="GITHUB_TOKEN" className="h-9 font-mono text-sm" />
            </div>
            <div>
              <Label className="text-[11px]">Value</Label>
              <Input type="password" value={value} onChange={(e) => setValue(e.target.value)}
                placeholder="ghp_..." className="h-9 font-mono text-sm" />
            </div>
          </div>
          <Button onClick={add} disabled={saving} size="sm" className="w-full gap-2">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add Secret
          </Button>
        </div>

        {/* Existing secrets */}
        {loading ? (
          <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : secrets.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No secrets saved yet. Add one above to let the AI use it.
          </div>
        ) : (
          <div className="space-y-2">
            {secrets.map(s => {
              const isEdit = editId === s.id;
              const isVisible = showId === s.id;
              return (
                <div key={s.id} className="rounded-xl border border-border/40 bg-card p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge variant="outline" className="font-mono text-[10px]">{s.name}</Badge>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(s.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  {isEdit ? (
                    <div className="flex items-center gap-1.5">
                      <Input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        className="h-8 font-mono text-xs flex-1" autoFocus />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit(s)}>
                        <Save className="h-3.5 w-3.5 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditId(null); setEditValue(''); }}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <code className="flex-1 text-xs font-mono bg-secondary/40 rounded px-2 py-1 truncate">
                        {isVisible ? s.value : mask(s.value)}
                      </code>
                      <Button size="icon" variant="ghost" className="h-8 w-8"
                        onClick={() => setShowId(isVisible ? null : s.id)}>
                        {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8"
                        onClick={() => { setEditId(s.id); setEditValue(s.value); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => remove(s)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
