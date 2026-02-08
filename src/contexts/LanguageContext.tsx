import { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'bn';

interface Translations {
  [key: string]: {
    en: string;
    bn: string;
  };
}

const translations: Translations = {
  // Login Page
  'login.title': { en: 'Welcome back', bn: 'স্বাগতম' },
  'login.subtitle': { en: 'Sign in to your Dreem Dev account', bn: 'আপনার Dreem Dev অ্যাকাউন্টে সাইন ইন করুন' },
  'login.email': { en: 'Email', bn: 'ইমেইল' },
  'login.password': { en: 'Password', bn: 'পাসওয়ার্ড' },
  'login.rememberMe': { en: 'Remember me', bn: 'আমাকে মনে রাখুন' },
  'login.signIn': { en: 'Sign In', bn: 'সাইন ইন' },
  'login.signingIn': { en: 'Signing in...', bn: 'সাইন ইন হচ্ছে...' },
  'login.invalidCredentials': { en: 'Invalid email or password', bn: 'ভুল ইমেইল বা পাসওয়ার্ড' },
  'login.tagline': { en: 'AI-Powered Development', bn: 'এআই-চালিত ডেভেলপমেন্ট' },

  // Dashboard
  'dashboard.projects': { en: 'Projects', bn: 'প্রজেক্টস' },
  'dashboard.projectsDesc': { en: 'Build and manage your AI-powered projects', bn: 'আপনার এআই প্রজেক্ট তৈরি ও পরিচালনা করুন' },
  'dashboard.newProject': { en: 'New Project', bn: 'নতুন প্রজেক্ট' },
  'dashboard.createProject': { en: 'Create Project', bn: 'প্রজেক্ট তৈরি করুন' },
  'dashboard.noProjects': { en: 'No projects yet', bn: 'এখনো কোনো প্রজেক্ট নেই' },
  'dashboard.noProjectsDesc': { en: 'Create your first project to get started', bn: 'শুরু করতে আপনার প্রথম প্রজেক্ট তৈরি করুন' },
  'dashboard.searchProjects': { en: 'Search projects...', bn: 'প্রজেক্ট খুঁজুন...' },
  'dashboard.allProjects': { en: 'All Projects', bn: 'সব প্রজেক্ট' },
  'dashboard.recent': { en: 'Recent', bn: 'সাম্প্রতিক' },
  'dashboard.favorites': { en: 'Favorites', bn: 'পছন্দের' },
  'dashboard.lastModified': { en: 'Last modified', bn: 'শেষ পরিবর্তন' },
  'dashboard.open': { en: 'Open', bn: 'খুলুন' },
  'dashboard.delete': { en: 'Delete', bn: 'মুছুন' },
  'dashboard.rename': { en: 'Rename', bn: 'নাম পরিবর্তন' },
  'dashboard.favorite': { en: 'Favorite', bn: 'পছন্দে যোগ করুন' },
  'dashboard.unfavorite': { en: 'Unfavorite', bn: 'পছন্দ থেকে সরান' },

  // Sidebar
  'sidebar.projects': { en: 'Projects', bn: 'প্রজেক্টস' },
  'sidebar.settings': { en: 'Settings', bn: 'সেটিংস' },
  'sidebar.account': { en: 'Account', bn: 'অ্যাকাউন্ট' },
  'sidebar.signOut': { en: 'Sign Out', bn: 'সাইন আউট' },

  // Create Project Dialog
  'createProject.title': { en: 'Create New Project', bn: 'নতুন প্রজেক্ট তৈরি করুন' },
  'createProject.name': { en: 'Project Name', bn: 'প্রজেক্টের নাম' },
  'createProject.namePlaceholder': { en: 'My awesome project', bn: 'আমার অসাধারণ প্রজেক্ট' },
  'createProject.description': { en: 'Description', bn: 'বিবরণ' },
  'createProject.descriptionPlaceholder': { en: 'Describe your project...', bn: 'আপনার প্রজেক্টের বিবরণ দিন...' },
  'createProject.cancel': { en: 'Cancel', bn: 'বাতিল' },
  'createProject.create': { en: 'Create', bn: 'তৈরি করুন' },

  // Theme
  'theme.light': { en: 'Light', bn: 'লাইট' },
  'theme.dark': { en: 'Dark', bn: 'ডার্ক' },

  // Language
  'language.english': { en: 'English', bn: 'ইংরেজি' },
  'language.bengali': { en: 'Bengali', bn: 'বাংলা' },

  // Common
  'common.gridView': { en: 'Grid View', bn: 'গ্রিড ভিউ' },
  'common.listView': { en: 'List View', bn: 'লিস্ট ভিউ' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('dreem-language');
    if (stored === 'en' || stored === 'bn') return stored;
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('dreem-language', lang);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'bn' : 'en');
  };

  const t = (key: string): string => {
    const translation = translations[key];
    if (!translation) return key;
    return translation[language] || translation.en || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
