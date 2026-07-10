import { useState, useEffect } from 'react';
import { useAgentStore } from '../store/useAgentStore';

/**
 * Context-aware suggestion chips.
 * Generates short "I want to..." style follow-ups derived from what the AI
 * just said, so chips never repeat the raw assistant message verbatim.
 * Kept fully local for now (no extra AI call) — deterministic keyword mapping
 * from the last assistant message → curated Bengali action prompts.
 */

const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  code: [
    'এটি এখন গিটহাবে পুশ করো',
    'বাগ চেক করে ফিক্স করো',
    'একটি নতুন কম্পোনেন্ট যোগ করো',
    'ডিজাইন আরও আধুনিক করো',
  ],
  build: [
    'APK বিল্ড শুরু করো',
    'EXE বিল্ড শুরু করো',
    'ZIP আকারে ডাউনলোড দাও',
    'Vercel-এ ডিপ্লয় করো',
  ],
  deploy: [
    'ডিপ্লয় স্ট্যাটাস দেখাও',
    'বিল্ড লগ খোলো',
    'নতুন রিলিজ তৈরি করো',
  ],
  research: [
    'আরও তথ্য সংগ্রহ করো',
    'আরেকটি সোর্স খুঁজে দাও',
    'সংক্ষিপ্ত সারাংশ বানাও',
  ],
  error: [
    'রিট্রাই করো',
    'ভিন্ন প্রোভাইডার দিয়ে চেষ্টা করো',
    'সমস্যাটি বিস্তারিত ব্যাখ্যা করো',
  ],
  default: [
    'পরবর্তী ধাপ কী?',
    'সম্পূর্ণ প্ল্যান দেখাও',
    'GitHub-এ সেভ করো',
    'প্রিভিউ দেখাও',
  ],
};

function classify(text: string): string {
  const t = (text || '').toLowerCase();
  if (/error|failed|ব্যর্থ|সমস্যা/.test(t)) return 'error';
  if (/apk|exe|build|বিল্ড|ডাউনলোড/.test(t)) return 'build';
  if (/deploy|vercel|ডিপ্লয়/.test(t)) return 'deploy';
  if (/search|research|তথ্য|খুঁজ/.test(t)) return 'research';
  if (/```|component|function|কোড|ফাইল/.test(t)) return 'code';
  return 'default';
}

export const useAgentSuggestions = (lastMessage?: string) => {
  const [suggestions, setSuggestions] = useState<string[]>(CATEGORY_SUGGESTIONS.default);
  const { status } = useAgentStore();

  useEffect(() => {
    if (status === 'working' || status === 'thinking') {
      setSuggestions([]);
      return;
    }
    const key = classify(lastMessage ?? '');
    setSuggestions(CATEGORY_SUGGESTIONS[key] ?? CATEGORY_SUGGESTIONS.default);
  }, [status, lastMessage]);

  return suggestions;
};