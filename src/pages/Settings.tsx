import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Github, Key, Palette, User, CheckCircle2, XCircle, Eye, EyeOff, Save, RotateCcw, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeLanguageToggle } from '@/components/ThemeLanguageToggle';

const STORAGE_KEY = 'dreem-settings';

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { user, isAdmin, logout } = useAuth();

  const [githubToken, setGithubToken] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored).githubToken || '';
    } catch { /* */ }
    return '';
  });

  const [showToken, setShowToken] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSave = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    let data: Record<string, unknown> = {};
    try { if (stored) data = JSON.parse(stored); } catch { /* */ }
    data.githubToken = githubToken;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setHasChanges(false);
    toast({ title: t('settings.saved'), description: t('settings.savedDesc') });
  };

  const mask = (v: string) => !v ? '' : v.length <= 8 ? '••••••••' : v.slice(0, 4) + '••••••••' + v.slice(-4);
  const configured = !!githubToken && githubToken.length > 3;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ArrowLeft className="h-4 w-4" /></Button>
            <h1 className="font-semibold">{t('settings.title')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeLanguageToggle />
            {hasChanges && (
              <Button size="sm" onClick={handleSave}><Save className="mr-1.5 h-4 w-4" />{t('settings.save')}</Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 md:p-8 space-y-6">
        {/* Account */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />{t('settings.account')}</CardTitle>
            <CardDescription>{t('settings.accountDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{user?.email || 'user@example.com'}</p>
                <p className="text-sm text-muted-foreground">{t('settings.loggedInAs')}</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => navigate('/admin')} className="gap-1.5">
                    <Shield className="h-3.5 w-3.5" />Admin Panel
                  </Button>
                )}
                <Button variant="destructive" size="sm" onClick={() => { logout(); navigate('/login'); }}>
                  {t('settings.logout')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GitHub Token — for all users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Github className="h-5 w-5" />GitHub Token</CardTitle>
            <CardDescription>Connect your GitHub account to create and manage repositories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="githubToken" className="flex items-center gap-2"><Key className="h-3.5 w-3.5" />Personal Access Token</Label>
                <Badge variant="outline" className={`text-[10px] gap-1 ${configured ? 'border-primary/30 text-primary' : 'border-muted-foreground/30 text-muted-foreground'}`}>
                  {configured ? <><CheckCircle2 className="h-2.5 w-2.5" /> Active</> : <><XCircle className="h-2.5 w-2.5" /> Not set</>}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                github.com → Settings → Developer Settings → Personal Access Tokens → Generate (repo, workflow permissions)
              </p>
              <div className="relative">
                <Input id="githubToken" type={showToken ? 'text' : 'password'}
                  value={showToken ? githubToken : mask(githubToken)}
                  onChange={(e) => { setGithubToken(e.target.value); setHasChanges(true); }}
                  placeholder="ghp_..." className="pr-10 font-mono text-sm" />
                <Button type="button" variant="ghost" size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowToken(!showToken)}>
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" />{t('settings.appearance')}</CardTitle>
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
