import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startAdminPushListener, stopAdminPushListener, startUserPushListener, stopUserPushListener } from '@/services/pushNotificationService';

interface User {
  email: string;
  id?: string;
}

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check admin role via edge function (which reads ADMIN_EMAIL secret server-side)
  const syncRole = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAdmin(false);
        return;
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-check`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setIsAdmin(!!data.isAdmin);
        // Fire-and-forget audit-log of the login event.
        try {
          await (supabase as any).rpc('log_auth_event', {
            event: data.isAdmin ? 'admin_login' : 'user_login',
            detail: { provider: session.user.app_metadata?.provider || 'unknown' },
          });
        } catch { /* non-fatal */ }
        if (data.isAdmin) {
          // Auto-start desktop notification listener for admin sessions
          startAdminPushListener().catch(() => {});
        } else {
          stopAdminPushListener();
          // Regular users get notified when admin replies
          const { data: { user } } = await supabase.auth.getUser();
          if (user) startUserPushListener(user.id).catch(() => {});
        }
      } else {
        setIsAdmin(false);
      }
    } catch {
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setIsLoading(true);
        setUser({ email: session.user.email, id: session.user.id });
        // Defer role sync to avoid blocking the auth callback
        setTimeout(() => { syncRole().finally(() => setIsLoading(false)); }, 0);
      } else {
        setUser(null);
        setIsAdmin(false);
        setIsLoading(false);
      }
    });

    // Then check existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.email) {
        setUser({ email: session.user.email, id: session.user.id });
        await syncRole();
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Legacy email/password login — now uses Supabase auth
  const login = async (email: string, password: string, _remember = false) => {
    // Try normal sign-in first. Only on failure do we fall back to the admin-bootstrap
    // endpoint — and only then is the credential sent server-side. This avoids exposing
    // every regular user's plaintext password to the bootstrap endpoint on each login.
    const first = await supabase.auth.signInWithPassword({ email, password });
    if (!first.error && first.data.user) return true;

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-bootstrap`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) return false;
    } catch {
      return false;
    }

    const retry = await supabase.auth.signInWithPassword({ email, password });
    return !retry.error && !!retry.data.user;
  };

  const logout = async () => {
    try {
      await (supabase as any).rpc('log_auth_event', { event: 'logout', detail: {} });
    } catch { /* non-fatal */ }
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    stopUserPushListener();
    stopAdminPushListener();
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
