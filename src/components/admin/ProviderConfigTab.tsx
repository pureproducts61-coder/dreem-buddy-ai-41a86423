import { useEffect, useState } from 'react';
import { Bot, Plus, Trash2, RefreshCw, Zap, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ProviderRow {
  id: string;
  provider: string;
  model: string;
  display_name: string | null;
  api_key_secret_name: string | null;
  base_url: string | null;
  enabled: boolean;
  is_free: boolean;
  priority: number;
  capabilities: string[];
  task_types: string[];
}

interface RoutingRow {
  id?: string;
  task_type: string;
  preferred_config_id: string | null;
  fallback_config_ids: string[];
  auto_route: boolean;
}

const TASK_TYPES = ['chat', 'code', 'research', 'vision', 'quick', 'deep_reasoning', 'embedding'];
const PROVIDERS = ['lovable', 'gemini', 'groq', 'deepseek', 'openrouter', 'hf', 'openai', 'anthropic', 'custom'];

export function ProviderConfigTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [routing, setRouting] = useState<RoutingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRow, setNewRow] = useState({ provider: 'gemini', model: '', api_key_secret_name: '', is_free: true });

  const load = async () => {
    setLoading(true);
    const [{ data: configs }, { data: routes }] = await Promise.all([
      supabase.from('ai_provider_configs').select('*').order('priority'),
      supabase.from('ai_task_routing').select('*'),
    ]);
    setRows((configs ?? []) as any);
    // Ensure all task types have a routing row
    const map = new Map<string, RoutingRow>((routes ?? []).map((r: any) => [r.task_type, r]));
    setRouting(TASK_TYPES.map((t) => map.get(t) ?? { task_type: t, preferred_config_id: null, fallback_config_ids: [], auto_route: true }));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleEnabled = async (id: string, enabled: boolean) => {
    await supabase.from('ai_provider_configs').update({ enabled }).eq('id', id);
    setRows((r) => r.map((x) => x.id === id ? { ...x, enabled } : x));
    toast({ title: enabled ? 'Provider enabled' : 'Provider disabled' });
  };

  const updatePriority = async (id: string, priority: number) => {
    await supabase.from('ai_provider_configs').update({ priority }).eq('id', id);
    setRows((r) => r.map((x) => x.id === id ? { ...x, priority } : x));
  };

  const updateSecretName = async (id: string, api_key_secret_name: string) => {
    await supabase.from('ai_provider_configs').update({ api_key_secret_name }).eq('id', id);
    setRows((r) => r.map((x) => x.id === id ? { ...x, api_key_secret_name } : x));
  };

  const deleteRow = async (id: string) => {
    if (!confirm('Delete this provider config?')) return;
    await supabase.from('ai_provider_configs').delete().eq('id', id);
    setRows((r) => r.filter((x) => x.id !== id));
  };

  const addRow = async () => {
    if (!newRow.model.trim()) { toast({ title: 'Model required', variant: 'destructive' }); return; }
    const { data, error } = await supabase.from('ai_provider_configs').insert({
      provider: newRow.provider,
      model: newRow.model.trim(),
      display_name: `${newRow.provider} · ${newRow.model.trim()}`,
      api_key_secret_name: newRow.api_key_secret_name || null,
      is_free: newRow.is_free,
      enabled: true,
      priority: 50,
      capabilities: ['chat', 'code'],
      task_types: ['chat', 'code'],
    }).select().single();
    if (error) { toast({ title: 'Add failed', description: error.message, variant: 'destructive' }); return; }
    setRows((r) => [...r, data as any]);
    setNewRow({ provider: 'gemini', model: '', api_key_secret_name: '', is_free: true });
    toast({ title: 'Provider added' });
  };

  const updateRouting = async (task: string, patch: Partial<RoutingRow>) => {
    const existing = routing.find((r) => r.task_type === task)!;
    const merged = { ...existing, ...patch };
    setRouting((rs) => rs.map((r) => r.task_type === task ? merged : r));
    await supabase.from('ai_task_routing').upsert({
      task_type: task,
      preferred_config_id: merged.preferred_config_id,
      fallback_config_ids: merged.fallback_config_ids,
      auto_route: merged.auto_route,
    }, { onConflict: 'task_type' });
  };

  if (loading) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Loading providers...</CardContent></Card>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />AI Providers & Models</CardTitle>
              <CardDescription>Enable/disable providers, set priority, and map secret names. Lower priority = tried first.</CardDescription>
            </div>
            <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="border rounded-lg p-3 space-y-2 bg-card/50">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Badge variant="outline" className="text-[10px]">{row.provider}</Badge>
                  <span className="text-sm font-mono truncate">{row.model}</span>
                  {row.is_free && <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30">FREE</Badge>}
                  {row.enabled
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    : <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={row.enabled} onCheckedChange={(c) => toggleEnabled(row.id, c)} />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteRow(row.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Priority</Label>
                  <Input type="number" value={row.priority} onChange={(e) => updatePriority(row.id, parseInt(e.target.value) || 0)} className="h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Secret name</Label>
                  <Input value={row.api_key_secret_name ?? ''} placeholder="LOVABLE_API_KEY" onChange={(e) => updateSecretName(row.id, e.target.value)} className="h-7 text-xs font-mono" />
                </div>
              </div>
              <div className="flex gap-1 flex-wrap">
                {row.task_types.map((t) => <Badge key={t} variant="secondary" className="text-[9px]">{t}</Badge>)}
              </div>
            </div>
          ))}
          <div className="border-2 border-dashed rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" />Add new provider/model</p>
            <div className="grid grid-cols-2 gap-2">
              <Select value={newRow.provider} onValueChange={(v) => setNewRow((n) => ({ ...n, provider: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
              <Input value={newRow.model} placeholder="model-id (e.g. gemini-2.0-flash-exp)" onChange={(e) => setNewRow((n) => ({ ...n, model: e.target.value }))} className="h-8 text-xs" />
              <Input value={newRow.api_key_secret_name} placeholder="Secret name (GEMINI_API_KEY)" onChange={(e) => setNewRow((n) => ({ ...n, api_key_secret_name: e.target.value }))} className="h-8 text-xs font-mono" />
              <div className="flex items-center gap-2">
                <Switch checked={newRow.is_free} onCheckedChange={(c) => setNewRow((n) => ({ ...n, is_free: c }))} />
                <span className="text-xs">Free tier</span>
              </div>
            </div>
            <Button size="sm" onClick={addRow} className="w-full h-8"><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />Task → Provider Routing</CardTitle>
          <CardDescription>Auto = pick best enabled provider by priority. Manual = force a specific model.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {routing.map((r) => (
            <div key={r.task_type} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold capitalize flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />{r.task_type.replace('_', ' ')}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Auto</span>
                  <Switch checked={r.auto_route} onCheckedChange={(c) => updateRouting(r.task_type, { auto_route: c })} />
                </div>
              </div>
              {!r.auto_route && (
                <Select value={r.preferred_config_id ?? 'none'} onValueChange={(v) => updateRouting(r.task_type, { preferred_config_id: v === 'none' ? null : v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick preferred model" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— none (fallback to auto) —</SelectItem>
                    {rows.filter((x) => x.enabled).map((row) => (
                      <SelectItem key={row.id} value={row.id}>{row.provider} · {row.model}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
