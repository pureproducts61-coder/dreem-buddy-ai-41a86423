import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Zap, Shield, Terminal, Wifi, WifiOff } from 'lucide-react';
import { ThemeToggle, LanguageToggle } from '@/components/ThemeLanguageToggle';
import { motion, AnimatePresence } from 'framer-motion';

const Login = () => {
  const [backendUrl, setBackendUrl] = useState(() => localStorage.getItem('dreem-hf-url') || '');
  const [masterSecret, setMasterSecret] = useState(() => localStorage.getItem('dreem-master-secret') || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    // Generate background particles
    const pts = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 5,
    }));
    setParticles(pts);
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backendUrl.trim() || !masterSecret.trim()) {
      setError(t('login.fillAllFields'));
      return;
    }
    setError('');
    setLoading(true);
    setConnectionStatus('connecting');

    // Store credentials
    localStorage.setItem('dreem-hf-url', backendUrl.trim());
    localStorage.setItem('dreem-master-secret', masterSecret.trim());

    // Simulate connection validation
    const success = await login(backendUrl.trim(), masterSecret.trim(), true);
    setLoading(false);

    if (success) {
      setConnectionStatus('connected');
      setTimeout(() => navigate('/'), 800);
    } else {
      setConnectionStatus('failed');
      setError(t('login.connectionFailed'));
    }
  };

  const statusColors = {
    idle: 'text-muted-foreground',
    connecting: 'text-warning',
    connected: 'text-neon-green',
    failed: 'text-destructive',
  };

  const statusIcons = {
    idle: <WifiOff className="h-3 w-3" />,
    connecting: <Loader2 className="h-3 w-3 animate-spin" />,
    connected: <Wifi className="h-3 w-3" />,
    failed: <WifiOff className="h-3 w-3" />,
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden">
      {/* Animated Grid Background */}
      <div className="pointer-events-none fixed inset-0 war-room-grid opacity-60" />
      
      {/* Scanline Effect */}
      <div className="pointer-events-none fixed inset-0 scanline opacity-30" />

      {/* Floating Particles */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute h-1 w-1 rounded-full bg-primary/30"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: 3 + Math.random() * 3,
              repeat: Infinity,
              delay: p.delay,
            }}
          />
        ))}
      </div>

      {/* Theme & Language Toggles */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-1">
        <ThemeToggle />
        <LanguageToggle />
      </div>

      {/* Connection Status Indicator */}
      <motion.div
        className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-border/50 bg-card/80 backdrop-blur-sm px-3 py-1.5"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <span className={statusColors[connectionStatus]}>{statusIcons[connectionStatus]}</span>
        <span className={`text-xs font-mono ${statusColors[connectionStatus]}`}>
          {t(`login.status.${connectionStatus}`)}
        </span>
      </motion.div>

      <motion.div
        className="relative z-10 w-full max-w-[440px] px-4"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Logo & Branding */}
        <motion.div
          className="mb-8 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/30 glow-cyan">
            <Zap className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-wider text-primary glow-text-cyan">
            DREEM DEV
          </h1>
          <p className="mt-2 text-sm font-mono text-muted-foreground tracking-wide">
            {t('login.tagline')}
          </p>
        </motion.div>

        {/* Connection Card */}
        <motion.div
          className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md p-6 shadow-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="mb-5 flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <h2 className="font-display text-sm font-semibold tracking-wider uppercase">
              {t('login.connectionSetup')}
            </h2>
          </div>

          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="backendUrl" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                {t('login.backendUrl')}
              </Label>
              <Input
                id="backendUrl"
                type="url"
                placeholder="https://your-space.hf.space"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                required
                className="font-mono text-sm bg-secondary/50 border-border/50 focus:border-primary/50 focus:glow-cyan"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="masterSecret" className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  {t('login.masterSecret')}
                </span>
              </Label>
              <Input
                id="masterSecret"
                type="password"
                placeholder="••••••••••••"
                value={masterSecret}
                onChange={(e) => setMasterSecret(e.target.value)}
                required
                className="font-mono text-sm bg-secondary/50 border-border/50 focus:border-primary/50"
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-sm text-destructive font-mono"
                >
                  ⚠ {error}
                </motion.p>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              className="w-full font-display text-sm tracking-wider uppercase glow-cyan hover:glow-cyan-strong transition-all"
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
                  <Zap className="h-4 w-4" />
                  {t('login.connect')}
                </>
              )}
            </Button>
          </form>
        </motion.div>

        {/* Footer */}
        <motion.p
          className="mt-6 text-center text-xs font-mono text-muted-foreground/60 tracking-wide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          DREEM DEV — AI WAR ROOM v1.0
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Login;
