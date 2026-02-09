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

  // Workspace
  'workspace.preview': { en: 'Preview', bn: 'প্রিভিউ' },
  'workspace.code': { en: 'Code', bn: 'কোড' },
  'workspace.aiHelper': { en: 'Your AI coding assistant', bn: 'আপনার এআই কোডিং সহকারী' },
  'workspace.welcomeChat': { en: 'How can I help you?', bn: 'আমি কীভাবে সাহায্য করতে পারি?' },
  'workspace.welcomeChatDesc': { en: 'Describe what you want to build and I\'ll help you create it.', bn: 'আপনি কী তৈরি করতে চান তা বর্ণনা করুন এবং আমি আপনাকে সাহায্য করব।' },
  'workspace.thinking': { en: 'Thinking...', bn: 'ভাবছি...' },
  'workspace.typeMessage': { en: 'Describe what you want to build...', bn: 'আপনি কী তৈরি করতে চান বর্ণনা করুন...' },
  'workspace.chatHint': { en: 'Press Enter to send, Shift+Enter for new line', bn: 'পাঠাতে Enter চাপুন, নতুন লাইনের জন্য Shift+Enter' },
  'workspace.files': { en: 'Files', bn: 'ফাইলস' },
  'workspace.noFileOpen': { en: 'Select a file to view its contents', bn: 'কন্টেন্ট দেখতে একটি ফাইল নির্বাচন করুন' },
  'workspace.previewTitle': { en: 'Live Preview', bn: 'লাইভ প্রিভিউ' },
  'workspace.previewDesc': { en: 'Your app preview will appear here as you build', bn: 'আপনি তৈরি করার সাথে সাথে আপনার অ্যাপ প্রিভিউ এখানে দেখা যাবে' },
  'workspace.livePreview': { en: 'Live preview active', bn: 'লাইভ প্রিভিউ সক্রিয়' },

  // Settings
  'settings.title': { en: 'Settings', bn: 'সেটিংস' },
  'settings.saved': { en: 'Settings Saved', bn: 'সেটিংস সংরক্ষিত' },
  'settings.savedDesc': { en: 'Your settings have been saved successfully', bn: 'আপনার সেটিংস সফলভাবে সংরক্ষিত হয়েছে' },
  'settings.reset': { en: 'Reset', bn: 'রিসেট' },
  'settings.save': { en: 'Save', bn: 'সংরক্ষণ' },
  'settings.account': { en: 'Account', bn: 'অ্যাকাউন্ট' },
  'settings.accountDesc': { en: 'Manage your account settings', bn: 'আপনার অ্যাকাউন্ট সেটিংস পরিচালনা করুন' },
  'settings.loggedInAs': { en: 'Logged in as', bn: 'লগইন করা আছে' },
  'settings.backend': { en: 'Backend Configuration', bn: 'ব্যাকএন্ড কনফিগারেশন' },
  'settings.backendDesc': { en: 'Configure your HF Spaces backend connection', bn: 'আপনার HF Spaces ব্যাকএন্ড সংযোগ কনফিগার করুন' },
  'settings.backendUrl': { en: 'Backend URL', bn: 'ব্যাকএন্ড URL' },
  'settings.backendUrlHint': { en: 'Enter your Hugging Face Spaces endpoint URL', bn: 'আপনার Hugging Face Spaces এন্ডপয়েন্ট URL দিন' },
  'settings.autoSave': { en: 'Auto Save', bn: 'অটো সেভ' },
  'settings.autoSaveDesc': { en: 'Automatically save changes', bn: 'স্বয়ংক্রিয়ভাবে পরিবর্তন সংরক্ষণ করুন' },
  'settings.syncEnabled': { en: 'Cloud Sync', bn: 'ক্লাউড সিঙ্ক' },
  'settings.syncEnabledDesc': { en: 'Sync projects with backend when connected', bn: 'কানেক্টেড থাকলে ব্যাকএন্ডের সাথে প্রজেক্ট সিঙ্ক করুন' },
  'settings.aiModel': { en: 'AI Model', bn: 'এআই মডেল' },
  'settings.aiModelDesc': { en: 'Choose your preferred AI model', bn: 'আপনার পছন্দের এআই মডেল বেছে নিন' },
  'settings.defaultModel': { en: 'Default Model', bn: 'ডিফল্ট মডেল' },
  'settings.selectModel': { en: 'Select a model', bn: 'একটি মডেল নির্বাচন করুন' },
  'settings.apiKeys': { en: 'API Keys', bn: 'এপিআই কী' },
  'settings.apiKeysDesc': { en: 'Configure API keys for different services', bn: 'বিভিন্ন সার্ভিসের জন্য এপিআই কী কনফিগার করুন' },
  'settings.appearance': { en: 'Appearance', bn: 'অ্যাপিয়ারেন্স' },
  'settings.appearanceDesc': { en: 'Customize the look and feel', bn: 'দেখতে এবং অনুভূতি কাস্টমাইজ করুন' },
  'settings.currentTheme': { en: 'Current Theme', bn: 'বর্তমান থিম' },
  'settings.useToggle': { en: 'Use the header toggle to switch', bn: 'পরিবর্তন করতে হেডার টগল ব্যবহার করুন' },

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
