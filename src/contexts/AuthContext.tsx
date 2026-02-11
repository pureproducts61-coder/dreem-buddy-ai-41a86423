import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  email: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (urlOrEmail: string, secretOrPassword: string, remember?: boolean) => Promise<boolean>;
  logout: () => void;
}

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

  const login = async (urlOrEmail: string, secretOrPassword: string, remember = false) => {
    await new Promise(r => setTimeout(r, 1200));
    if (urlOrEmail.trim() && secretOrPassword.trim()) {
      const u = { email: urlOrEmail };
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
    localStorage.removeItem('tivo-hf-url');
    localStorage.removeItem('tivo-master-secret');
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
