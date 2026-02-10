import { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'bn';

interface Translations {
  [key: string]: { en: string; bn: string };
}

const translations: Translations = {
  // Login / Connection
  'login.tagline': { en: 'AI WAR ROOM — COMMAND CENTER', bn: 'এআই ওয়ার রুম — কমান্ড সেন্টার' },
  'login.connectionSetup': { en: 'Connection Setup', bn: 'কানেকশন সেটআপ' },
  'login.backendUrl': { en: 'HF Backend URL', bn: 'HF ব্যাকএন্ড URL' },
  'login.masterSecret': { en: 'Master Secret', bn: 'মাস্টার সিক্রেট' },
  'login.connect': { en: 'Connect', bn: 'কানেক্ট' },
  'login.connecting': { en: 'Establishing Link...', bn: 'সংযোগ স্থাপন হচ্ছে...' },
  'login.connected': { en: 'Connected', bn: 'সংযুক্ত' },
  'login.connectionFailed': { en: 'Connection failed. Check credentials.', bn: 'সংযোগ ব্যর্থ। তথ্য যাচাই করুন।' },
  'login.fillAllFields': { en: 'Fill all fields', bn: 'সব ফিল্ড পূরণ করুন' },
  'login.status.idle': { en: 'OFFLINE', bn: 'অফলাইন' },
  'login.status.connecting': { en: 'CONNECTING...', bn: 'সংযোগ হচ্ছে...' },
  'login.status.connected': { en: 'ONLINE', bn: 'অনলাইন' },
  'login.status.failed': { en: 'FAILED', bn: 'ব্যর্থ' },

  // Dashboard
  'dashboard.projects': { en: 'Mission Control', bn: 'মিশন কন্ট্রোল' },
  'dashboard.projectsDesc': { en: 'Active operations and deployments', bn: 'সক্রিয় অপারেশন ও ডিপ্লয়মেন্ট' },
  'dashboard.newProject': { en: 'New Mission', bn: 'নতুন মিশন' },
  'dashboard.createProject': { en: 'Launch Mission', bn: 'মিশন লঞ্চ করুন' },
  'dashboard.noProjects': { en: 'No active missions', bn: 'কোনো সক্রিয় মিশন নেই' },
  'dashboard.noProjectsDesc': { en: 'Deploy your first AI mission', bn: 'আপনার প্রথম এআই মিশন ডিপ্লয় করুন' },
  'dashboard.searchProjects': { en: 'Search missions...', bn: 'মিশন খুঁজুন...' },
  'dashboard.allProjects': { en: 'All Missions', bn: 'সব মিশন' },
  'dashboard.recent': { en: 'Recent', bn: 'সাম্প্রতিক' },
  'dashboard.favorites': { en: 'Priority', bn: 'অগ্রাধিকার' },
  'dashboard.lastModified': { en: 'Last active', bn: 'শেষ সক্রিয়' },
  'dashboard.open': { en: 'Enter', bn: 'প্রবেশ' },
  'dashboard.delete': { en: 'Terminate', bn: 'বাতিল' },
  'dashboard.rename': { en: 'Rename', bn: 'নাম পরিবর্তন' },
  'dashboard.favorite': { en: 'Priority', bn: 'অগ্রাধিকার' },
  'dashboard.unfavorite': { en: 'Normal', bn: 'সাধারণ' },

  // Sidebar
  'sidebar.projects': { en: 'Missions', bn: 'মিশনস' },
  'sidebar.settings': { en: 'Config', bn: 'কনফিগ' },
  'sidebar.account': { en: 'Operator', bn: 'অপারেটর' },
  'sidebar.signOut': { en: 'Disconnect', bn: 'সংযোগ বিচ্ছিন্ন' },

  // Create Project
  'createProject.title': { en: 'Deploy New Mission', bn: 'নতুন মিশন ডিপ্লয়' },
  'createProject.name': { en: 'Mission Name', bn: 'মিশনের নাম' },
  'createProject.namePlaceholder': { en: 'Operation Alpha', bn: 'অপারেশন আলফা' },
  'createProject.description': { en: 'Mission Brief', bn: 'মিশন ব্রিফ' },
  'createProject.descriptionPlaceholder': { en: 'Describe the mission objective...', bn: 'মিশনের উদ্দেশ্য বর্ণনা করুন...' },
  'createProject.cancel': { en: 'Abort', bn: 'বাতিল' },
  'createProject.create': { en: 'Deploy', bn: 'ডিপ্লয়' },

  // Theme
  'theme.light': { en: 'Light', bn: 'লাইট' },
  'theme.dark': { en: 'Dark', bn: 'ডার্ক' },

  // Language
  'language.english': { en: 'English', bn: 'ইংরেজি' },
  'language.bengali': { en: 'Bengali', bn: 'বাংলা' },

  // War Room Workspace
  'warroom.title': { en: 'AI WAR ROOM', bn: 'এআই ওয়ার রুম' },
  'warroom.liveFeed': { en: 'Live Feed', bn: 'লাইভ ফিড' },
  'warroom.liveFeedDesc': { en: 'Real-time AI activity log', bn: 'রিয়েল-টাইম এআই কার্যকলাপ লগ' },
  'warroom.tasks': { en: 'Operation Steps', bn: 'অপারেশন ধাপসমূহ' },
  'warroom.planning': { en: 'Planning', bn: 'পরিকল্পনা' },
  'warroom.research': { en: 'Research', bn: 'গবেষণা' },
  'warroom.coding': { en: 'Coding', bn: 'কোডিং' },
  'warroom.testing': { en: 'Testing', bn: 'পরীক্ষা' },
  'warroom.deploying': { en: 'Deploying', bn: 'ডিপ্লয়িং' },
  'warroom.approval': { en: 'Approval Required', bn: 'অনুমোদন প্রয়োজন' },
  'warroom.approvalDesc': { en: 'AI needs your permission', bn: 'এআই আপনার অনুমতি চাইছে' },
  'warroom.approve': { en: 'Approve', bn: 'অনুমোদন' },
  'warroom.deny': { en: 'Deny', bn: 'প্রত্যাখ্যান' },
  'warroom.preview': { en: 'Live Preview', bn: 'লাইভ প্রিভিউ' },
  'warroom.files': { en: 'File System', bn: 'ফাইল সিস্টেম' },
  'warroom.health': { en: 'System Health', bn: 'সিস্টেম স্বাস্থ্য' },
  'warroom.keepAlive': { en: 'Keep-Alive', bn: 'কিপ-অ্যালাইভ' },
  'warroom.cpu': { en: 'CPU', bn: 'সিপিইউ' },
  'warroom.memory': { en: 'Memory', bn: 'মেমরি' },
  'warroom.chat': { en: 'Command Input', bn: 'কমান্ড ইনপুট' },
  'warroom.chatPlaceholder': { en: 'Enter command or describe what to build...', bn: 'কমান্ড দিন বা কী তৈরি করতে চান বর্ণনা করুন...' },
  'warroom.voiceInput': { en: 'Voice Input', bn: 'ভয়েস ইনপুট' },
  'warroom.attachFile': { en: 'Attach File', bn: 'ফাইল সংযুক্ত' },
  'warroom.schedule': { en: 'Schedule Task', bn: 'টাস্ক শিডিউল' },
  'warroom.thinking': { en: 'AI Processing...', bn: 'এআই প্রসেসিং...' },
  'warroom.noFileOpen': { en: 'Select a file to inspect', bn: 'পরিদর্শনের জন্য ফাইল নির্বাচন করুন' },

  // Settings
  'settings.title': { en: 'Configuration', bn: 'কনফিগারেশন' },
  'settings.saved': { en: 'Config Saved', bn: 'কনফিগ সংরক্ষিত' },
  'settings.savedDesc': { en: 'Configuration updated successfully', bn: 'কনফিগারেশন সফলভাবে আপডেট হয়েছে' },
  'settings.reset': { en: 'Reset', bn: 'রিসেট' },
  'settings.save': { en: 'Save', bn: 'সংরক্ষণ' },
  'settings.account': { en: 'Operator', bn: 'অপারেটর' },
  'settings.accountDesc': { en: 'Manage operator credentials', bn: 'অপারেটর তথ্য পরিচালনা করুন' },
  'settings.loggedInAs': { en: 'Active operator', bn: 'সক্রিয় অপারেটর' },
  'settings.backend': { en: 'Backend Config', bn: 'ব্যাকএন্ড কনফিগ' },
  'settings.backendDesc': { en: 'HF Spaces backend connection', bn: 'HF Spaces ব্যাকএন্ড সংযোগ' },
  'settings.backendUrl': { en: 'Backend URL', bn: 'ব্যাকএন্ড URL' },
  'settings.backendUrlHint': { en: 'Hugging Face Spaces endpoint', bn: 'Hugging Face Spaces এন্ডপয়েন্ট' },
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

  // Common
  'common.gridView': { en: 'Grid', bn: 'গ্রিড' },
  'common.listView': { en: 'List', bn: 'লিস্ট' },
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
