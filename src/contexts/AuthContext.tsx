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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock credentials — will be replaced by HF Spaces backend
const MOCK_EMAIL = 'admin@dreemdev.com';
const MOCK_PASSWORD = 'dreem2024';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('dreem_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string, remember = false) => {
    // Simulate API call
    await new Promise(r => setTimeout(r, 800));
    if (email === MOCK_EMAIL && password === MOCK_PASSWORD) {
      const u = { email };
      setUser(u);
      if (remember) localStorage.setItem('dreem_user', JSON.stringify(u));
      else sessionStorage.setItem('dreem_user', JSON.stringify(u));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('dreem_user');
    sessionStorage.removeItem('dreem_user');
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
