import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Palette, User, Save, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { UserSecretsManager } from '@/components/user/UserSecretsManager';

const STORAGE_KEY = 'dreem-settings';

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { user, isAdmin, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ArrowLeft className="h-4 w-4" /></Button>
            <h1 className="font-semibold">{t('settings.title')}</h1>
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

        {/* Dynamic Secrets Vault — replaces the static GitHub field */}
        <UserSecretsManager />

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
