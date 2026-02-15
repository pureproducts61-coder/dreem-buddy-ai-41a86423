import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
    const stored = localStorage.getItem('tivo_user') || sessionStorage.getItem('tivo_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string, remember = false) => {
    await new Promise(r => setTimeout(r, 800));

    // Check against backend if configured, otherwise use local dummy credentials
    const backendUrl = localStorage.getItem('tivo-hf-url');
    
    if (backendUrl && backendUrl.trim()) {
      // TODO: When backend is connected, call API for auth
      // For now, still use local credentials
    }

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const u = { email };
      setUser(u);
      if (remember) localStorage.setItem('tivo_user', JSON.stringify(u));
      else sessionStorage.setItem('tivo_user', JSON.stringify(u));
      return true;
    }
    return false;
  };

  const logout = () => {
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
