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
        },
      });
      if (res.ok) {
        const data = await res.json();
        setIsAdmin(!!data.isAdmin);
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
        setUser({ email: session.user.email, id: session.user.id });
        // Defer role sync to avoid blocking the auth callback
        setTimeout(() => { syncRole(); }, 0);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
    });

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setUser({ email: session.user.email, id: session.user.id });
        syncRole();
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Legacy email/password login — now uses Supabase auth
  const login = async (email: string, password: string, _remember = false) => {
    // First attempt: try to bootstrap as admin (idempotent — only succeeds if creds match the
    // ADMIN_EMAIL/ADMIN_PASSWORD secrets). Failures here are silently ignored so regular users
    // can still sign in normally with their own accounts.
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-bootstrap`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
    } catch {
      // ignore — fall through to normal sign-in
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return false;
    // Role sync will happen automatically via onAuthStateChange
    return true;
  };

  const logout = async () => {
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
