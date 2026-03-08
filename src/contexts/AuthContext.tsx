import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface User {
  email: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<boolean>;
  logout: () => void;
}

// Dummy admin credentials — replace with backend auth when connected
const ADMIN_EMAIL = 'admin@tivo.ai';
const ADMIN_PASSWORD = 'tivo2025';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listen for Supabase auth changes (Google OAuth)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setUser({ email: session.user.email });
      }
    });

    // Check for existing Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setUser({ email: session.user.email });
      } else {
        // Fallback to local storage for admin login
        const stored = localStorage.getItem('tivo_user') || sessionStorage.getItem('tivo_user');
        if (stored) {
          try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
        }
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string, remember = false) => {
    await new Promise(r => setTimeout(r, 800));

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const u = { email };
      setUser(u);
      if (remember) localStorage.setItem('tivo_user', JSON.stringify(u));
      else sessionStorage.setItem('tivo_user', JSON.stringify(u));
      return true;
    }
    return false;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem('tivo_user');
    sessionStorage.removeItem('tivo_user');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
