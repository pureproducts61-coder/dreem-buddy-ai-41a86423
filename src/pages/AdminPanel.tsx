import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, CreditCard, Key, Bot, Server, Search, Globe, Rocket,
  CheckCircle2, XCircle, Eye, EyeOff, Save, Shield, Brain, Settings2,
  RefreshCw, Minus, Plus, UserCheck, UserX, Activity, Database, Zap,
  Hammer, MessageSquare, Image as ImageIcon, Sparkles, GitBranch, Bell, Inbox,
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
import { AdminMonitoringTab } from '@/components/admin/AdminMonitoringTab';
import { AdminMessagesTab } from '@/components/admin/AdminMessagesTab';
import { AdminNotificationsTab } from '@/components/admin/AdminNotificationsTab';
import { CustomDbTab } from '@/components/admin/CustomDbTab';
import { KillSwitchPanel } from '@/components/admin/KillSwitchPanel';
import { AutomationApprovalsTab } from '@/components/admin/AutomationApprovalsTab';
import { AdminAuditLogTab } from '@/components/admin/AdminAuditLogTab';
import { EmergencyContactsTab } from '@/components/admin/EmergencyContactsTab';
import { loadMergedSystemSettings, saveLocalSystemSettings, saveSystemSettingsToDb } from '@/services/systemSettingsService';
import { AdminWeeklyReportsTab } from '@/components/admin/AdminWeeklyReportsTab';
import { AdminUserManagementTab } from '@/components/admin/AdminUserManagementTab';

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
  const { isAdmin, isLoading } = useAuth();

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
    if (!isLoading && !isAdmin) navigate('/');
  }, [isAdmin, isLoading, navigate]);

  useEffect(() => {
    setDbAvailable(isDbConnected());
    if (isDbConnected()) loadUsers();
    loadMergedSystemSettings(defaultAdminSettings as unknown as Record<string, string | number | boolean>)
      .then((merged) => setSettings(merged as unknown as AdminSettings));
  }, []);

  useEffect(() => {
    const ch = supabase.channel('system-settings-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, () => {
        loadMergedSystemSettings(defaultAdminSettings as unknown as Record<string, string | number | boolean>)
          .then((merged) => setSettings(merged as unknown as AdminSettings));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
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

  const handleSave = async () => {
    try {
      saveLocalSystemSettings(settings as unknown as Record<string, string | number | boolean>);
      await saveSystemSettingsToDb(settings as unknown as Record<string, string | number | boolean>);
      setHasChanges(false);
      toast({ title: 'Settings saved', description: 'Database synced and AI will use these keys immediately.' });
    } catch (e) {
      saveLocalSystemSettings(settings as unknown as Record<string, string | number | boolean>);
      toast({ title: 'Saved locally', description: String(e), variant: 'destructive' });
    }
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
          <Input id={id} type={vis ? 'text' : 'password'} value={val}
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

  if (isLoading || !isAdmin) return null;

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
          <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7 h-auto">
            <TabsTrigger value="status" className="gap-1.5 flex-col sm:flex-row py-2"><Activity className="h-3.5 w-3.5" /><span className="text-[11px] sm:text-xs">Status</span></TabsTrigger>
            <TabsTrigger value="monitor" className="gap-1.5 flex-col sm:flex-row py-2"><Zap className="h-3.5 w-3.5" /><span className="text-[11px] sm:text-xs">Monitor</span></TabsTrigger>
            <TabsTrigger value="messages" className="gap-1.5 flex-col sm:flex-row py-2"><Inbox className="h-3.5 w-3.5" /><span className="text-[11px] sm:text-xs">Inbox</span></TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5 flex-col sm:flex-row py-2"><Bell className="h-3.5 w-3.5" /><span className="text-[11px] sm:text-xs">Alerts</span></TabsTrigger>
            <TabsTrigger value="api-keys" className="gap-1.5 flex-col sm:flex-row py-2"><Key className="h-3.5 w-3.5" /><span className="text-[11px] sm:text-xs">Keys</span></TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5 flex-col sm:flex-row py-2"><Users className="h-3.5 w-3.5" /><span className="text-[11px] sm:text-xs">Users</span></TabsTrigger>
            <TabsTrigger value="system" className="gap-1.5 flex-col sm:flex-row py-2"><Settings2 className="h-3.5 w-3.5" /><span className="text-[11px] sm:text-xs">System</span></TabsTrigger>
          </TabsList>

          {/* System Status Tab — secrets + capabilities */}
          <TabsContent value="status" className="space-y-6">
            <KillSwitchPanel />
            <SystemStatusPanel settings={settings} dbAvailable={dbAvailable} />
          </TabsContent>

          {/* Monitoring */}
          <TabsContent value="monitor" className="space-y-6">
            <EmergencyContactsTab />
            <AdminWeeklyReportsTab />
            <AutomationApprovalsTab />
            <AdminAuditLogTab />
            <AdminMonitoringTab />
          </TabsContent>

          {/* Messages from users */}
          <TabsContent value="messages" className="space-y-6">
            <AdminMessagesTab />
          </TabsContent>

          {/* AI notifications */}
          <TabsContent value="notifications" className="space-y-6">
            <AdminNotificationsTab />
          </TabsContent>

          {/* Custom DB switch — appears inside the System tab */}

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
            {!dbAvailable ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                <Users className="h-10 w-10 mx-auto opacity-30 mb-2" />
                Database not connected — configure Supabase in the System tab to enable user management.
              </CardContent></Card>
            ) : (
              <AdminUserManagementTab />
            )}
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
            <CustomDbTab />
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

/* ============================================================
   SYSTEM STATUS PANEL — Secrets + AI Capabilities overview
   ============================================================ */

interface SystemStatusPanelProps {
  settings: AdminSettings;
  dbAvailable: boolean;
}

function SystemStatusPanel({ settings, dbAvailable }: SystemStatusPanelProps) {
  const has = (v: string) => !!v && v.length > 3;

  // Server-side secrets (configured via Lovable Cloud Secrets)
  const serverSecrets = [
    { name: 'GEMINI_API_KEY', label: 'Gemini API', icon: Brain, configured: true, desc: 'Google AI text & vision' },
    { name: 'LOVABLE_API_KEY', label: 'Lovable AI Gateway', icon: Sparkles, configured: true, desc: 'Multi-model AI access' },
    { name: 'ADMIN_EMAIL', label: 'Admin Email', icon: Shield, configured: true, desc: 'Bootstrap admin login' },
    { name: 'ADMIN_PASSWORD', label: 'Admin Password', icon: Key, configured: true, desc: 'Bootstrap admin login' },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Service Role Key', icon: Database, configured: true, desc: 'Backend admin DB access' },
  ];

  // Client-side keys (configured via Admin Panel)
  const clientKeys = [
    { label: 'Groq', icon: Bot, configured: has(settings.groqApiKey) },
    { label: 'DeepSeek', icon: Bot, configured: has(settings.deepseekApiKey) },
    { label: 'Tavily Search', icon: Search, configured: has(settings.tavilyApiKey) },
    { label: 'Hugging Face', icon: Globe, configured: has(settings.hfToken) },
    { label: 'Vercel Deploy', icon: Rocket, configured: has(settings.vercelToken) },
  ];

  // AI capabilities derived from configured secrets
  const capabilities = [
    { label: 'Chat & Reasoning', icon: MessageSquare, enabled: true, source: 'Gemini / Lovable AI' },
    { label: 'Code Generation', icon: Hammer, enabled: true, source: 'Lovable AI Gateway' },
    { label: 'Image Understanding', icon: ImageIcon, enabled: true, source: 'Gemini Vision' },
    { label: 'Web Search', icon: Search, enabled: has(settings.tavilyApiKey), source: 'Tavily' },
    { label: 'GitHub Operations', icon: GitBranch, enabled: false, source: 'User-level GitHub PAT' },
    { label: 'Vercel Deploy', icon: Rocket, enabled: has(settings.vercelToken), source: 'Vercel API' },
    { label: 'Database Access', icon: Database, enabled: dbAvailable, source: 'Supabase / Lovable Cloud' },
    { label: 'User Management', icon: Users, enabled: dbAvailable, source: 'Supabase Auth + RLS' },
  ];

  const enabledCount = capabilities.filter(c => c.enabled).length;
  const totalSecrets = serverSecrets.length + clientKeys.length;
  const configuredSecrets = serverSecrets.filter(s => s.configured).length + clientKeys.filter(k => k.configured).length;

  return (
    <>
      {/* Hero status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <HeroStat
          icon={Activity}
          label="System"
          value={dbAvailable ? 'Operational' : 'Degraded'}
          tone={dbAvailable ? 'success' : 'warning'}
          sub={dbAvailable ? 'All core services healthy' : 'Database not connected'}
        />
        <HeroStat
          icon={Key}
          label="Secrets"
          value={`${configuredSecrets}/${totalSecrets}`}
          tone="primary"
          sub="Configured credentials"
        />
        <HeroStat
          icon={Zap}
          label="AI Capabilities"
          value={`${enabledCount}/${capabilities.length}`}
          tone="primary"
          sub="Active features"
        />
      </div>

      {/* Server-side secrets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            Server-side Secrets (Lovable Cloud)
          </CardTitle>
          <CardDescription>Securely stored backend credentials — accessed by edge functions only</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {serverSecrets.map(s => (
            <StatusRow
              key={s.name}
              icon={s.icon}
              label={s.label}
              hint={`${s.name} — ${s.desc}`}
              configured={s.configured}
            />
          ))}
        </CardContent>
      </Card>

      {/* Client-side keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4" />
            Optional Provider Keys
          </CardTitle>
          <CardDescription>Configure these in the Keys tab to unlock more capabilities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {clientKeys.map(k => (
            <StatusRow key={k.label} icon={k.icon} label={k.label} configured={k.configured} />
          ))}
        </CardContent>
      </Card>

      {/* AI Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" />
            AI Capabilities
          </CardTitle>
          <CardDescription>What TIVO AI can do right now based on configured credentials</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {capabilities.map(cap => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.label}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    cap.enabled
                      ? 'border-primary/20 bg-primary/5'
                      : 'border-border/40 bg-muted/20 opacity-60'
                  }`}
                >
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                    cap.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{cap.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{cap.source}</p>
                  </div>
                  {cap.enabled ? (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Database status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" />
            Database Connection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`flex items-center gap-3 p-4 rounded-lg border ${
            dbAvailable
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-orange-500/30 bg-orange-500/5'
          }`}>
            <div className={`h-2.5 w-2.5 rounded-full ${
              dbAvailable ? 'bg-emerald-500 shadow-[0_0_8px_hsl(var(--primary))]' : 'bg-orange-500'
            } animate-pulse`} />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {dbAvailable ? 'Lovable Cloud — Connected' : 'Local Storage Mode'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {dbAvailable
                  ? 'Realtime sync, RLS-protected user data, edge functions active'
                  : 'Data stored locally — connect Supabase in System tab to sync'}
              </p>
            </div>
            <Badge variant={dbAvailable ? 'default' : 'secondary'} className="text-[10px]">
              {dbAvailable ? 'LIVE' : 'OFFLINE'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function HeroStat({
  icon: Icon, label, value, sub, tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  tone: 'success' | 'warning' | 'primary';
}) {
  const toneClass = {
    success: 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent text-emerald-500',
    warning: 'border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent text-orange-500',
    primary: 'border-primary/30 bg-gradient-to-br from-primary/10 to-transparent text-primary',
  }[tone];

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4" />
        <p className="text-[10px] font-mono uppercase tracking-wider opacity-80">{label}</p>
      </div>
      <p className="text-2xl font-display font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

function StatusRow({
  icon: Icon, label, hint, configured,
}: {
  icon: React.ElementType;
  label: string;
  hint?: string;
  configured: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
        configured ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground/60'
      }`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground font-mono truncate">{hint}</p>}
      </div>
      <Badge
        variant="outline"
        className={`text-[10px] gap-1 shrink-0 ${
          configured ? 'border-primary/30 text-primary' : 'border-muted-foreground/30 text-muted-foreground'
        }`}
      >
        {configured ? <><CheckCircle2 className="h-2.5 w-2.5" />Active</> : <><XCircle className="h-2.5 w-2.5" />Not set</>}
      </Badge>
    </div>
  );
}
