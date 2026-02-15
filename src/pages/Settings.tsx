import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Server, Bot, Palette, Key, Eye, EyeOff, Save, RotateCcw, Globe, User, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
    // Save backend config separately
    localStorage.setItem('tivo-hf-url', settings.backendUrl);
    localStorage.setItem('tivo-master-secret', settings.masterSecret);
    // Save rest
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

  const renderApiKeyInput = (id: keyof SettingsData, label: string, placeholder: string) => {
    const value = settings[id] as string;
    const isVisible = showKeys[id];
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
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

        {/* Backend Configuration — moved from Login */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              {t('settings.backend')}
            </CardTitle>
            <CardDescription>{t('settings.backendDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="backendUrl">{t('settings.backendUrl')}</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="backendUrl"
                  value={settings.backendUrl}
                  onChange={(e) => updateSetting('backendUrl', e.target.value)}
                  placeholder="https://your-space.hf.space"
                  className="pl-10 font-mono text-sm"
                />
              </div>
            </div>

            {renderApiKeyInput('masterSecret', t('settings.masterSecret'), '••••••••••••')}

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

        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              {t('settings.apiKeys')}
            </CardTitle>
            <CardDescription>{t('settings.apiKeysDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderApiKeyInput('geminiApiKey', 'Gemini API Key', 'AIza...')}
            {renderApiKeyInput('groqApiKey', 'Groq API Key', 'gsk_...')}
            {renderApiKeyInput('deepseekApiKey', 'DeepSeek API Key', 'sk-...')}
            <Separator />
            {renderApiKeyInput('githubToken', 'GitHub Token', 'ghp_...')}
            {renderApiKeyInput('tavilyApiKey', 'Tavily API Key', 'tvly-...')}
            {renderApiKeyInput('hfToken', 'Hugging Face Token', 'hf_...')}
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
