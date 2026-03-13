import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Server, Bot, Palette, Key, Eye, EyeOff, Save, RotateCcw, Globe, User,
  CheckCircle2, XCircle, Rocket, Search, Brain, Github,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeLanguageToggle } from '@/components/ThemeLanguageToggle';

interface SettingsData {
  backendUrl: string;
  masterSecret: string;
  aiModel: string;
  geminiApiKey: string;
  groqApiKey: string;
  deepseekApiKey: string;
  githubToken: string;
  tavilyApiKey: string;
  hfToken: string;
  vercelToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  autoSave: boolean;
  syncEnabled: boolean;
}

const defaultSettings: SettingsData = {
  backendUrl: '',
  masterSecret: '',
  aiModel: 'gemini',
  geminiApiKey: '',
  groqApiKey: '',
  deepseekApiKey: '',
  githubToken: '',
  tavilyApiKey: '',
  hfToken: '',
  vercelToken: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
  autoSave: true,
  syncEnabled: false,
};

const STORAGE_KEY = 'dreem-settings';

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { user, logout } = useAuth();

  const [settings, setSettings] = useState<SettingsData>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const backendUrl = localStorage.getItem('tivo-hf-url') || '';
    const masterSecret = localStorage.getItem('tivo-master-secret') || '';
    if (stored) {
      try {
        return { ...defaultSettings, ...JSON.parse(stored), backendUrl, masterSecret };
      } catch {
        return { ...defaultSettings, backendUrl, masterSecret };
      }
    }
    return { ...defaultSettings, backendUrl, masterSecret };
  });

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const updateSetting = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const toggleKeyVisibility = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    localStorage.setItem('tivo-hf-url', settings.backendUrl);
    localStorage.setItem('tivo-master-secret', settings.masterSecret);
    const { backendUrl, masterSecret, ...rest } = settings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    setHasChanges(false);
    toast({ title: t('settings.saved'), description: t('settings.savedDesc') });
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    setHasChanges(true);
  };

  const maskApiKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  };

  const isConfigured = (key: string) => !!key && key.length > 3;

  const renderApiKeyInput = (
    id: keyof SettingsData,
    label: string,
    placeholder: string,
    icon?: React.ReactNode,
    description?: string,
  ) => {
    const value = settings[id] as string;
    const isVisible = showKeys[id];
    const configured = isConfigured(value);

    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor={id} className="flex items-center gap-2">
            {icon}
            {label}
          </Label>
          {configured ? (
            <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
              <CheckCircle2 className="h-2.5 w-2.5" /> Active
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] gap-1 border-muted-foreground/30 text-muted-foreground">
              <XCircle className="h-2.5 w-2.5" /> Not set
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-[11px] text-muted-foreground">{description}</p>
        )}
        <div className="relative">
          <Input
            id={id}
            type={isVisible ? 'text' : 'password'}
            value={isVisible ? value : maskApiKey(value)}
            onChange={(e) => updateSetting(id, e.target.value)}
            placeholder={placeholder}
            className="pr-10 font-mono text-sm"
          />
          <Button
            type="button" variant="ghost" size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => toggleKeyVisibility(id)}
          >
            {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="font-semibold">{t('settings.title')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeLanguageToggle />
            {hasChanges && (
              <>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                  {t('settings.reset')}
                </Button>
                <Button size="sm" onClick={handleSave}>
                  <Save className="mr-1.5 h-4 w-4" />
                  {t('settings.save')}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 md:p-8 space-y-6">
        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {t('settings.account')}
            </CardTitle>
            <CardDescription>{t('settings.accountDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{user?.email || 'admin@tivo.ai'}</p>
                <p className="text-sm text-muted-foreground">{t('settings.loggedInAs')}</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => { logout(); navigate('/login'); }}>
                {t('settings.logout')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Backend Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              {t('settings.backend')}
            </CardTitle>
            <CardDescription>{t('settings.backendDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="backendUrl" className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5" />
                {t('settings.backendUrl')}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                HuggingFace Spaces or custom backend endpoint for enhanced AI capabilities
              </p>
              <div className="relative">
                <Input
                  id="backendUrl"
                  value={settings.backendUrl}
                  onChange={(e) => updateSetting('backendUrl', e.target.value)}
                  placeholder="https://your-space.hf.space"
                  className="font-mono text-sm"
                />
              </div>
              {isConfigured(settings.backendUrl) && (
                <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Connected
                </Badge>
              )}
            </div>

            {renderApiKeyInput('masterSecret', t('settings.masterSecret'), '••••••••••••', undefined,
              'Master secret for authenticating with backend API')}

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.autoSave')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.autoSaveDesc')}</p>
              </div>
              <Switch checked={settings.autoSave} onCheckedChange={(c) => updateSetting('autoSave', c)} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.syncEnabled')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.syncEnabledDesc')}</p>
              </div>
              <Switch checked={settings.syncEnabled} onCheckedChange={(c) => updateSetting('syncEnabled', c)} />
            </div>
          </CardContent>
        </Card>

        {/* AI Model */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              {t('settings.aiModel')}
            </CardTitle>
            <CardDescription>{t('settings.aiModelDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="aiModel">{t('settings.defaultModel')}</Label>
              <Select value={settings.aiModel} onValueChange={(v) => updateSetting('aiModel', v)}>
                <SelectTrigger><SelectValue placeholder={t('settings.selectModel')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="groq">Groq (Llama)</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* API Keys — AI Providers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Provider Keys
            </CardTitle>
            <CardDescription>API keys for AI model providers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {renderApiKeyInput('geminiApiKey', 'Gemini API Key', 'AIza...',
              <Bot className="h-3.5 w-3.5" />, 'Google AI Studio → Get API Key')}
            {renderApiKeyInput('groqApiKey', 'Groq API Key', 'gsk_...',
              <Bot className="h-3.5 w-3.5" />, 'console.groq.com → API Keys')}
            {renderApiKeyInput('deepseekApiKey', 'DeepSeek API Key', 'sk-...',
              <Bot className="h-3.5 w-3.5" />, 'platform.deepseek.com → API Keys')}
          </CardContent>
        </Card>

        {/* API Keys — Tools & Integrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Tools & Integrations
            </CardTitle>
            <CardDescription>Tokens for GitHub, Vercel, search, and other services</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {renderApiKeyInput('githubToken', 'GitHub Token', 'ghp_...',
              <Github className="h-3.5 w-3.5" />,
              'Full access token — repo, workflow, admin permissions. github.com → Settings → Developer Settings → Personal Access Tokens')}
            {renderApiKeyInput('vercelToken', 'Vercel Token', 'vercel_...',
              <Rocket className="h-3.5 w-3.5" />,
              'AI will verify deployments & auto-fix bugs. vercel.com → Settings → Tokens')}
            {renderApiKeyInput('tavilyApiKey', 'Tavily API Key', 'tvly-...',
              <Search className="h-3.5 w-3.5" />,
              'Web search for latest docs & APIs. tavily.com → Dashboard → API Keys')}
            {renderApiKeyInput('hfToken', 'Hugging Face Token', 'hf_...',
              <Globe className="h-3.5 w-3.5" />,
              'Access HF models & Spaces. huggingface.co → Settings → Access Tokens')}
          </CardContent>
        </Card>

        {/* Database */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Database (Supabase)
            </CardTitle>
            <CardDescription>Connect your own Supabase project for data persistence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {renderApiKeyInput('supabaseUrl', 'Supabase URL', 'https://xxx.supabase.co',
              <Globe className="h-3.5 w-3.5" />, 'Project URL from Supabase Dashboard → Settings → API')}
            {renderApiKeyInput('supabaseAnonKey', 'Supabase Anon Key', 'eyJ...',
              <Key className="h-3.5 w-3.5" />, 'Publishable anon key from Supabase Dashboard → Settings → API')}
          </CardContent>
        </Card>

        {/* Theme */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t('settings.appearance')}
            </CardTitle>
            <CardDescription>{t('settings.appearanceDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.currentTheme')}</Label>
                <p className="text-xs text-muted-foreground">
                  {theme === 'light' ? t('theme.light') : t('theme.dark')}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">{t('settings.useToggle')}</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;