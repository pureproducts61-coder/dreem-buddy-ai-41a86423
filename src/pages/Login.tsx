import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Shield, Wifi, WifiOff, ArrowRight } from 'lucide-react';
import { ThemeToggle, LanguageToggle } from '@/components/ThemeLanguageToggle';
import { motion, AnimatePresence } from 'framer-motion';

const Login = () => {
  const [backendUrl, setBackendUrl] = useState(() => localStorage.getItem('tivo-hf-url') || '');
  const [masterSecret, setMasterSecret] = useState(() => localStorage.getItem('tivo-master-secret') || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backendUrl.trim() || !masterSecret.trim()) {
      setError(t('login.fillAllFields'));
      return;
    }
    setError('');
    setLoading(true);
    setConnectionStatus('connecting');

    localStorage.setItem('tivo-hf-url', backendUrl.trim());
    localStorage.setItem('tivo-master-secret', masterSecret.trim());

    const success = await login(backendUrl.trim(), masterSecret.trim(), true);
    setLoading(false);

    if (success) {
      setConnectionStatus('connected');
      setTimeout(() => navigate('/'), 600);
    } else {
      setConnectionStatus('failed');
      setError(t('login.connectionFailed'));
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden gradient-navy-red">
      {/* Subtle background */}
      <div className="pointer-events-none fixed inset-0 subtle-grid opacity-30" />

      {/* Top bar */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-1">
        <ThemeToggle />
        <LanguageToggle />
      </div>

      {/* Status */}
      <motion.div
        className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-border/20 bg-card/30 backdrop-blur-xl px-3 py-1.5"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        {connectionStatus === 'connecting' ? (
          <Loader2 className="h-3 w-3 animate-spin text-warning" />
        ) : connectionStatus === 'connected' ? (
          <Wifi className="h-3 w-3 text-success" />
        ) : (
          <WifiOff className="h-3 w-3 text-muted-foreground" />
        )}
        <span className="text-xs font-mono text-foreground/70">
          {t(`login.status.${connectionStatus}`)}
        </span>
      </motion.div>

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
          <div className="text-5xl mb-3">❤️</div>
          <h1 className="text-4xl font-display font-bold tracking-tight mb-1.5">
            <span className="gradient-text-brand">TIVO AI</span>
          </h1>
          <p className="text-sm text-foreground/50">
            {t('login.tagline')}
          </p>
        </motion.div>

        {/* Form Card */}
        <motion.div
          className="glass-card p-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <h2 className="text-sm font-semibold mb-5 flex items-center gap-2 text-foreground">
            <Shield className="h-4 w-4 text-primary" />
            {t('login.connectionSetup')}
          </h2>

          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="backendUrl" className="text-xs text-foreground/60">
                {t('login.backendUrl')}
              </Label>
              <Input
                id="backendUrl"
                type="url"
                placeholder="https://your-space.hf.space"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                required
                className="bg-secondary/30 border-border/30 font-mono text-sm backdrop-blur-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="masterSecret" className="text-xs text-foreground/60">
                {t('login.masterSecret')}
              </Label>
              <Input
                id="masterSecret"
                type="password"
                placeholder="••••••••••••"
                value={masterSecret}
                onChange={(e) => setMasterSecret(e.target.value)}
                required
                className="bg-secondary/30 border-border/30 font-mono text-sm backdrop-blur-sm"
              />
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
                  {t('login.connecting')}
                </>
              ) : connectionStatus === 'connected' ? (
                <>
                  <Wifi className="h-4 w-4" />
                  {t('login.connected')}
                </>
              ) : (
                <>
                  {t('login.connect')}
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
