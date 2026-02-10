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
    // Check localStorage and sessionStorage
    const stored = localStorage.getItem('dreem_user') || sessionStorage.getItem('dreem_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setIsLoading(false);
  }, []);

  const login = async (urlOrEmail: string, secretOrPassword: string, remember = false) => {
    // Simulate connection validation
    await new Promise(r => setTimeout(r, 1200));
    
    // Accept any non-empty URL + secret combo (mock validation)
    if (urlOrEmail.trim() && secretOrPassword.trim()) {
      const u = { email: urlOrEmail };
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
    localStorage.removeItem('dreem-hf-url');
    localStorage.removeItem('dreem-master-secret');
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
