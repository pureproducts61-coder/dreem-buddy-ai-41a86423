import { useState } from 'react';
import tivoLogo from '@/assets/tivo-logo.png';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Shield, ArrowRight, Lock, Mail } from 'lucide-react';
import { ThemeToggle, LanguageToggle } from '@/components/ThemeLanguageToggle';
import { motion, AnimatePresence } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { lovable } from '@/integrations/lovable/index';
import { supabase } from '@/integrations/supabase/client';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError(t('login.fillAllFields'));
      return;
    }
    setError('');
    setLoading(true);

    const success = await login(email.trim(), password.trim(), remember);
    setLoading(false);

    if (success) {
      navigate('/');
    } else {
      setError(t('login.invalidCredentials'));
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden gradient-navy-red">
      <div className="pointer-events-none fixed inset-0 subtle-grid opacity-30" />

      {/* Top bar */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-1">
        <ThemeToggle />
        <LanguageToggle />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-[400px] px-5"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <img src={tivoLogo} alt="TIVO AI" className="w-16 h-16 mb-3 mx-auto drop-shadow-[0_0_20px_rgba(204,0,0,0.5)]" />
          <h1 className="text-4xl font-display font-bold tracking-tight mb-1.5">
            <span className="gradient-text-brand">TIVO AI</span>
          </h1>
          <p className="text-sm text-foreground/50">
            {t('login.tagline')}
          </p>
        </motion.div>

        {/* Login Form */}
        <motion.div
          className="glass-card p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <h2 className="text-sm font-semibold mb-5 flex items-center gap-2 text-foreground">
            <Shield className="h-4 w-4 text-primary" />
            {t('login.adminLogin')}
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs text-foreground/60">
                {t('login.email')}
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@tivo.ai"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 bg-secondary/30 border-border/30 text-sm backdrop-blur-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs text-foreground/60">
                {t('login.password')}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 bg-secondary/30 border-border/30 text-sm backdrop-blur-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(checked) => setRemember(checked === true)}
              />
              <Label htmlFor="remember" className="text-xs text-foreground/60 cursor-pointer">
                {t('login.rememberMe')}
              </Label>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-sm text-destructive"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              className="w-full glow-primary font-medium tracking-wide"
              disabled={loading}
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('login.loggingIn')}
                </>
              ) : (
                <>
                  {t('login.signIn')}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </motion.div>

        <motion.p
          className="mt-8 text-center text-[11px] text-foreground/25"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          TIVO AI OS v2.0
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Login;
