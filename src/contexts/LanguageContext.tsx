import { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'bn';

interface Translations {
  [key: string]: { en: string; bn: string };
}

const translations: Translations = {
  // Login / Connection
  'login.tagline': { en: 'Your AI-Powered Command Center', bn: 'আপনার এআই-চালিত কমান্ড সেন্টার' },
  'login.connectionSetup': { en: 'Connect to Backend', bn: 'ব্যাকএন্ডে সংযোগ করুন' },
  'login.backendUrl': { en: 'Backend URL', bn: 'ব্যাকএন্ড URL' },
  'login.masterSecret': { en: 'Master Secret', bn: 'মাস্টার সিক্রেট' },
  'login.connect': { en: 'Connect', bn: 'সংযোগ করুন' },
  'login.connecting': { en: 'Connecting...', bn: 'সংযোগ হচ্ছে...' },
  'login.connected': { en: 'Connected', bn: 'সংযুক্ত' },
  'login.connectionFailed': { en: 'Connection failed. Check credentials.', bn: 'সংযোগ ব্যর্থ। তথ্য যাচাই করুন।' },
  'login.fillAllFields': { en: 'Please fill all fields', bn: 'সব ফিল্ড পূরণ করুন' },
  'login.status.idle': { en: 'Offline', bn: 'অফলাইন' },
  'login.status.connecting': { en: 'Connecting...', bn: 'সংযোগ হচ্ছে...' },
  'login.status.connected': { en: 'Online', bn: 'অনলাইন' },
  'login.status.failed': { en: 'Failed', bn: 'ব্যর্থ' },

  // Home
  'home.greeting': { en: 'What would you like to create?', bn: 'আপনি কী তৈরি করতে চান?' },
  'home.inputPlaceholder': { en: 'Describe what you want to build...', bn: 'আপনি কী তৈরি করতে চান বর্ণনা করুন...' },
  'home.send': { en: 'Send', bn: 'পাঠান' },
  'home.voiceInput': { en: 'Voice Input', bn: 'ভয়েস ইনপুট' },
  'home.attachFiles': { en: 'Attach Files', bn: 'ফাইল সংযুক্ত করুন' },
  'home.listening': { en: 'Listening...', bn: 'শুনছি...' },

  // Modes
  'mode.build': { en: 'Build', bn: 'বিল্ড' },
  'mode.automation': { en: 'Automation', bn: 'অটোমেশন' },
  'mode.plan': { en: 'Plan', bn: 'প্ল্যান' },

  // Build workspace
  'build.preview': { en: 'Preview', bn: 'প্রিভিউ' },
  'build.thinking': { en: 'AI is working...', bn: 'এআই কাজ করছে...' },
  'build.noProject': { en: 'Start by describing your project', bn: 'আপনার প্রজেক্ট বর্ণনা করে শুরু করুন' },

  // Automation
  'automation.title': { en: 'Automation Hub', bn: 'অটোমেশন হাব' },
  'automation.selectProject': { en: 'Select a project', bn: 'একটি প্রজেক্ট নির্বাচন করুন' },
  'automation.runLogic': { en: 'Run automation', bn: 'অটোমেশন চালান' },
  'automation.noProjects': { en: 'No projects yet', bn: 'এখনো কোনো প্রজেক্ট নেই' },

  // Control Panel (Three-dot menu)
  'panel.publish': { en: 'Publish', bn: 'পাবলিশ' },
  'panel.publishDesc': { en: 'Host directly on backend', bn: 'সরাসরি ব্যাকএন্ডে হোস্ট করুন' },
  'panel.edit': { en: 'Edit', bn: 'সম্পাদনা' },
  'panel.editDesc': { en: 'Project name & domain', bn: 'প্রজেক্ট নাম ও ডোমেইন' },
  'panel.deploy': { en: 'Deploy', bn: 'ডিপ্লয়' },
  'panel.deployDesc': { en: 'Connect to GitHub', bn: 'গিটহাবে সংযুক্ত করুন' },
  'panel.history': { en: 'History', bn: 'ইতিহাস' },
  'panel.historyDesc': { en: 'All project changes', bn: 'সব পরিবর্তনের ইতিহাস' },

  // Header menu categories
  'header.automated': { en: 'Automated', bn: 'অটোমেটেড' },
  'header.built': { en: 'Built', bn: 'বিল্ট' },
  'header.published': { en: 'Published', bn: 'পাবলিশড' },
  'header.chatHistory': { en: 'Chat History', bn: 'চ্যাট ইতিহাস' },

  // Settings
  'settings.title': { en: 'Settings', bn: 'সেটিংস' },
  'settings.backend': { en: 'Backend Configure', bn: 'ব্যাকএন্ড কনফিগার' },
  'settings.backendDesc': { en: 'URL & Secret management', bn: 'URL ও সিক্রেট ম্যানেজমেন্ট' },
  'settings.backendUrl': { en: 'Backend URL', bn: 'ব্যাকএন্ড URL' },
  'settings.backendUrlHint': { en: 'Hugging Face Spaces endpoint', bn: 'Hugging Face Spaces এন্ডপয়েন্ট' },
  'settings.theme': { en: 'Theme', bn: 'থিম' },
  'settings.themeDesc': { en: 'Appearance settings', bn: 'অ্যাপিয়ারেন্স সেটিংস' },
  'settings.language': { en: 'Language', bn: 'ভাষা' },
  'settings.languageDesc': { en: 'Interface language', bn: 'ইন্টারফেস ভাষা' },
  'settings.profile': { en: 'Profile', bn: 'প্রোফাইল' },
  'settings.profileDesc': { en: 'Account settings', bn: 'অ্যাকাউন্ট সেটিংস' },
  'settings.logout': { en: 'Logout', bn: 'লগআউট' },
  'settings.saved': { en: 'Settings Saved', bn: 'সেটিংস সংরক্ষিত' },
  'settings.savedDesc': { en: 'Changes applied successfully', bn: 'পরিবর্তন সফলভাবে প্রয়োগ হয়েছে' },
  'settings.save': { en: 'Save', bn: 'সংরক্ষণ' },
  'settings.reset': { en: 'Reset', bn: 'রিসেট' },
  'settings.account': { en: 'Account', bn: 'অ্যাকাউন্ট' },
  'settings.accountDesc': { en: 'Manage credentials', bn: 'তথ্য পরিচালনা করুন' },
  'settings.loggedInAs': { en: 'Connected as', bn: 'সংযুক্ত' },
  'settings.autoSave': { en: 'Auto Save', bn: 'অটো সেভ' },
  'settings.autoSaveDesc': { en: 'Auto-save changes', bn: 'স্বয়ংক্রিয় সংরক্ষণ' },
  'settings.syncEnabled': { en: 'Cloud Sync', bn: 'ক্লাউড সিঙ্ক' },
  'settings.syncEnabledDesc': { en: 'Sync with backend', bn: 'ব্যাকএন্ডের সাথে সিঙ্ক' },
  'settings.aiModel': { en: 'AI Model', bn: 'এআই মডেল' },
  'settings.aiModelDesc': { en: 'Select AI model', bn: 'এআই মডেল নির্বাচন' },
  'settings.defaultModel': { en: 'Default Model', bn: 'ডিফল্ট মডেল' },
  'settings.selectModel': { en: 'Select model', bn: 'মডেল নির্বাচন' },
  'settings.apiKeys': { en: 'API Keys', bn: 'এপিআই কী' },
  'settings.apiKeysDesc': { en: 'Service credentials', bn: 'সার্ভিস তথ্য' },
  'settings.appearance': { en: 'Appearance', bn: 'অ্যাপিয়ারেন্স' },
  'settings.appearanceDesc': { en: 'UI customization', bn: 'ইউআই কাস্টমাইজেশন' },
  'settings.currentTheme': { en: 'Current Theme', bn: 'বর্তমান থিম' },
  'settings.useToggle': { en: 'Use header toggle', bn: 'হেডার টগল ব্যবহার করুন' },

  // Vault
  'vault.title': { en: 'Project Vault', bn: 'প্রজেক্ট ভল্ট' },
  'vault.subtitle': { en: 'Manage your built projects', bn: 'আপনার তৈরি প্রজেক্ট পরিচালনা করুন' },
  'vault.empty': { en: 'No projects yet. Start building!', bn: 'এখনো কোনো প্রজেক্ট নেই। তৈরি শুরু করুন!' },
  'vault.edit': { en: 'Edit', bn: 'এডিট' },
  'vault.publish': { en: 'Publish', bn: 'পাবলিশ' },
  'vault.delete': { en: 'Delete', bn: 'ডিলিট' },

  // Preview
  'preview.empty': { en: 'Enter a URL to preview your project', bn: 'আপনার প্রজেক্ট দেখতে URL দিন' },

  // Common
  'common.close': { en: 'Close', bn: 'বন্ধ' },
  'common.cancel': { en: 'Cancel', bn: 'বাতিল' },
  'common.confirm': { en: 'Confirm', bn: 'নিশ্চিত' },
  'common.loading': { en: 'Loading...', bn: 'লোড হচ্ছে...' },

  // Theme
  'theme.light': { en: 'Light', bn: 'লাইট' },
  'theme.dark': { en: 'Dark', bn: 'ডার্ক' },

  // Sidebar (legacy)
  'sidebar.signOut': { en: 'Disconnect', bn: 'সংযোগ বিচ্ছিন্ন' },

  // Legacy warroom keys for compatibility
  'warroom.preview': { en: 'Preview', bn: 'প্রিভিউ' },
  'warroom.thinking': { en: 'AI Processing...', bn: 'এআই প্রসেসিং...' },
  'warroom.noFileOpen': { en: 'Select a file', bn: 'ফাইল নির্বাচন করুন' },
  'warroom.chatPlaceholder': { en: 'Enter command...', bn: 'কমান্ড দিন...' },
  'warroom.voiceInput': { en: 'Voice', bn: 'ভয়েস' },
  'warroom.attachFile': { en: 'Attach', bn: 'সংযুক্ত' },
  'warroom.schedule': { en: 'Schedule', bn: 'শিডিউল' },
  'warroom.planning': { en: 'Planning', bn: 'পরিকল্পনা' },
  'warroom.research': { en: 'Research', bn: 'গবেষণা' },
  'warroom.coding': { en: 'Coding', bn: 'কোডিং' },
  'warroom.testing': { en: 'Testing', bn: 'পরীক্ষা' },
  'warroom.deploying': { en: 'Deploying', bn: 'ডিপ্লয়িং' },
  'warroom.liveFeed': { en: 'Live Feed', bn: 'লাইভ ফিড' },
  'warroom.liveFeedDesc': { en: 'Real-time AI log', bn: 'রিয়েল-টাইম এআই লগ' },
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
    const stored = localStorage.getItem('tivo-language');
    if (stored === 'en' || stored === 'bn') return stored;
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('tivo-language', lang);
  };

  const toggleLanguage = () => setLanguage(language === 'en' ? 'bn' : 'en');

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
  if (context === undefined) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}
