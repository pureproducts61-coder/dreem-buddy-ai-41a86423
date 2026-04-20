import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, CreditCard, Key, Bot, Server, Search, Globe, Rocket,
  CheckCircle2, XCircle, Eye, EyeOff, Save, Shield, Brain, Settings2,
  RefreshCw, Minus, Plus, UserCheck, UserX, Activity, Database, Zap,
  Hammer, MessageSquare, Image as ImageIcon, Sparkles, GitBranch,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeLanguageToggle } from '@/components/ThemeLanguageToggle';
import { supabase } from '@/integrations/supabase/client';
import { isDbConnected } from '@/services/hybridStorageService';

const STORAGE_KEY = 'dreem-settings';

interface AdminSettings {
  backendUrl: string;
  masterSecret: string;
  aiModel: string;
  geminiApiKey: string;
  groqApiKey: string;
  deepseekApiKey: string;
  tavilyApiKey: string;
  hfToken: string;
  vercelToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  autoSave: boolean;
  syncEnabled: boolean;
  defaultUserCredits: number;
}

const defaultAdminSettings: AdminSettings = {
  backendUrl: '', masterSecret: '', aiModel: 'gemini',
  geminiApiKey: '', groqApiKey: '', deepseekApiKey: '',
  tavilyApiKey: '', hfToken: '', vercelToken: '',
  supabaseUrl: '', supabaseAnonKey: '',
  autoSave: true, syncEnabled: false, defaultUserCredits: 50,
};

interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  credits: number;
  github_token: string | null;
  last_active: string | null;
  created_at: string;
}

const AdminPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  const [settings, setSettings] = useState<AdminSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const backendUrl = localStorage.getItem('tivo-hf-url') || '';
    const masterSecret = localStorage.getItem('tivo-master-secret') || '';
    const credits = parseInt(localStorage.getItem('tivo-default-credits') || '50', 10);
    if (stored) {
      try {
        return { ...defaultAdminSettings, ...JSON.parse(stored), backendUrl, masterSecret, defaultUserCredits: credits };
      } catch { /* fallthrough */ }
    }
    return { ...defaultAdminSettings, backendUrl, masterSecret, defaultUserCredits: credits };
  });

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [dbAvailable, setDbAvailable] = useState(false);

  useEffect(() => {
    if (!isAdmin) navigate('/');
  }, [isAdmin, navigate]);

  useEffect(() => {
    setDbAvailable(isDbConnected());
    if (isDbConnected()) loadUsers();
  }, []);

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_list_profiles');
      if (error) throw error;
      setUsers((data || []) as unknown as UserProfile[]);
    } catch (e) {
      console.error('Failed to load users:', e);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const updateUserCredits = async (userId: string, newCredits: number) => {
    try {
      const { error } = await supabase.rpc('admin_update_credits', {
        target_user_id: userId,
        new_credits: newCredits,
      });
      if (error) throw error;
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, credits: newCredits } : u));
      toast({ title: 'Credits updated' });
    } catch (e) {
      toast({ title: 'Error', description: String(e), variant: 'destructive' });
    }
  };

  const update = <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const toggleKey = (k: string) => setShowKeys((p) => ({ ...p, [k]: !p[k] }));

  const handleSave = () => {
    localStorage.setItem('tivo-hf-url', settings.backendUrl);
    localStorage.setItem('tivo-master-secret', settings.masterSecret);
    localStorage.setItem('tivo-default-credits', String(settings.defaultUserCredits));
    const { backendUrl, masterSecret, defaultUserCredits, ...rest } = settings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    setHasChanges(false);
    toast({ title: 'Settings saved', description: 'All configurations updated successfully.' });
  };

  const mask = (v: string) => !v ? '' : v.length <= 8 ? '••••••••' : v.slice(0, 4) + '••••••••' + v.slice(-4);
  const configured = (v: string) => !!v && v.length > 3;

  const apiField = (id: keyof AdminSettings, label: string, placeholder: string, icon: React.ReactNode, desc?: string) => {
    const val = settings[id] as string;
    const vis = showKeys[id];
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={id} className="flex items-center gap-2">{icon}{label}</Label>
          <Badge variant="outline" className={`text-[10px] gap-1 ${configured(val) ? 'border-primary/30 text-primary' : 'border-muted-foreground/30 text-muted-foreground'}`}>
            {configured(val) ? <><CheckCircle2 className="h-2.5 w-2.5" /> Active</> : <><XCircle className="h-2.5 w-2.5" /> Not set</>}
          </Badge>
        </div>
        {desc && <p className="text-[11px] text-muted-foreground">{desc}</p>}
        <div className="relative">
          <Input id={id} type={vis ? 'text' : 'password'} value={vis ? val : mask(val)}
            onChange={(e) => update(id, e.target.value)} placeholder={placeholder} className="pr-10 font-mono text-sm" />
          <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => toggleKey(id)}>
            {vis ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    );
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ArrowLeft className="h-4 w-4" /></Button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="font-semibold">Admin Panel</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeLanguageToggle />
            {hasChanges && (
              <Button size="sm" onClick={handleSave}><Save className="mr-1.5 h-4 w-4" />Save</Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 md:p-8">
        <Tabs defaultValue="status" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="status" className="gap-1.5 flex-col sm:flex-row py-2"><Activity className="h-3.5 w-3.5" /><span className="text-[11px] sm:text-xs">Status</span></TabsTrigger>
            <TabsTrigger value="api-keys" className="gap-1.5 flex-col sm:flex-row py-2"><Key className="h-3.5 w-3.5" /><span className="text-[11px] sm:text-xs">Keys</span></TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5 flex-col sm:flex-row py-2"><Users className="h-3.5 w-3.5" /><span className="text-[11px] sm:text-xs">Users</span></TabsTrigger>
            <TabsTrigger value="credits" className="gap-1.5 flex-col sm:flex-row py-2"><CreditCard className="h-3.5 w-3.5" /><span className="text-[11px] sm:text-xs">Credits</span></TabsTrigger>
            <TabsTrigger value="system" className="gap-1.5 flex-col sm:flex-row py-2"><Settings2 className="h-3.5 w-3.5" /><span className="text-[11px] sm:text-xs">System</span></TabsTrigger>
          </TabsList>

          {/* System Status Tab — secrets + capabilities */}
          <TabsContent value="status" className="space-y-6">
            <SystemStatusPanel settings={settings} dbAvailable={dbAvailable} />
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />AI Provider Keys</CardTitle>
                <CardDescription>These keys power AI capabilities for all users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {apiField('geminiApiKey', 'Gemini API Key', 'AIza...', <Bot className="h-3.5 w-3.5" />, 'Google AI Studio → Get API Key')}
                {apiField('groqApiKey', 'Groq API Key', 'gsk_...', <Bot className="h-3.5 w-3.5" />, 'console.groq.com → API Keys')}
                {apiField('deepseekApiKey', 'DeepSeek API Key', 'sk-...', <Bot className="h-3.5 w-3.5" />, 'platform.deepseek.com → API Keys')}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" />Tools & Integrations</CardTitle>
                <CardDescription>Tokens for deployment, search, and hosting services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {apiField('vercelToken', 'Vercel Token', 'vercel_...', <Rocket className="h-3.5 w-3.5" />, 'Vercel → Settings → Tokens')}
                {apiField('tavilyApiKey', 'Tavily API Key', 'tvly-...', <Search className="h-3.5 w-3.5" />, 'tavily.com → Dashboard → API Keys')}
                {apiField('hfToken', 'Hugging Face Token', 'hf_...', <Globe className="h-3.5 w-3.5" />, 'huggingface.co → Settings → Access Tokens')}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />User Management</CardTitle>
                    <CardDescription>
                      {dbAvailable ? `${users.length} registered user(s)` : 'Database not connected'}
                    </CardDescription>
                  </div>
                  {dbAvailable && (
                    <Button variant="outline" size="sm" onClick={loadUsers} disabled={usersLoading}>
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${usersLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!dbAvailable ? (
                  <div className="rounded-lg border border-dashed border-border/50 p-8 text-center">
                    <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground mb-1">No database connected</p>
                    <p className="text-xs text-muted-foreground/60">
                      Configure Supabase in the System tab to enable user management
                    </p>
                  </div>
                ) : usersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/50 p-8 text-center">
                    <UserX className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No users registered yet</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Credits</TableHead>
                          <TableHead>GitHub</TableHead>
                          <TableHead>Last Active</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-mono text-xs">{u.email || '—'}</TableCell>
                            <TableCell>
                              <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="text-[10px]">
                                {u.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6"
                                  onClick={() => updateUserCredits(u.user_id, Math.max(0, u.credits - 10))}>
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="font-mono text-sm w-10 text-center">{u.credits}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6"
                                  onClick={() => updateUserCredits(u.user_id, u.credits + 10)}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              {u.github_token ? (
                                <UserCheck className="h-4 w-4 text-primary" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground/40" />
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(u.last_active)}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min={0}
                                className="w-20 h-7 text-xs inline-block"
                                placeholder="Set"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const val = parseInt((e.target as HTMLInputElement).value, 10);
                                    if (!isNaN(val)) updateUserCredits(u.user_id, val);
                                    (e.target as HTMLInputElement).value = '';
                                  }
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Credits Tab */}
          <TabsContent value="credits" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Credit System</CardTitle>
                <CardDescription>Configure default credits for new users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Default Credits per User</Label>
                  <p className="text-[11px] text-muted-foreground">New users will receive this many credits upon registration</p>
                  <Input type="number" min={0} value={settings.defaultUserCredits}
                    onChange={(e) => update('defaultUserCredits', parseInt(e.target.value, 10) || 0)} className="max-w-[200px]" />
                </div>
                <Separator />
                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <Shield className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Admin Access</p>
                    <p className="text-xs text-muted-foreground">You have unlimited access as admin</p>
                  </div>
                  <Badge className="ml-auto">Unlimited</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" />Backend</CardTitle>
                <CardDescription>HuggingFace Spaces or custom backend</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {apiField('backendUrl', 'Backend URL', 'https://your-space.hf.space', <Globe className="h-3.5 w-3.5" />)}
                {apiField('masterSecret', 'Master Secret', '••••••••••••', <Key className="h-3.5 w-3.5" />)}
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto Save</Label>
                    <p className="text-xs text-muted-foreground">Automatically save changes</p>
                  </div>
                  <Switch checked={settings.autoSave} onCheckedChange={(c) => update('autoSave', c)} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Sync Enabled</Label>
                    <p className="text-xs text-muted-foreground">Auto-sync with backend</p>
                  </div>
                  <Switch checked={settings.syncEnabled} onCheckedChange={(c) => update('syncEnabled', c)} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" />Database</CardTitle>
                <CardDescription>
                  {dbAvailable
                    ? <span className="text-primary">✅ Connected</span>
                    : <span>Not connected — data stored locally</span>
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {apiField('supabaseUrl', 'Supabase URL', 'https://xxx.supabase.co', <Globe className="h-3.5 w-3.5" />)}
                {apiField('supabaseAnonKey', 'Supabase Anon Key', 'eyJ...', <Key className="h-3.5 w-3.5" />)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />AI Model</CardTitle>
                <CardDescription>Default AI model for the system</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={settings.aiModel} onValueChange={(v) => update('aiModel', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="groq">Groq (Llama)</SelectItem>
                    <SelectItem value="deepseek">DeepSeek</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPanel;
