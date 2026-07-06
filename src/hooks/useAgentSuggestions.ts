import { useState, useEffect } from 'react';
import { useAgentStore } from '../store/useAgentStore';

export const useAgentSuggestions = (lastMessage?: string) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const { status } = useAgentStore();

  useEffect(() => {
    if (status === 'completed') {
      // Logic to generate dynamic "I want..." prompts based on context
      setSuggestions([
        "আমি চাই এটি এখন গিটহাবে পুশ করতে",
        "আমি চাই প্রজেক্টটির একটি নতুন ফিচার যোগ করতে",
        "আমি চাই এর ডিজাইন আরও উন্নত করতে"
      ]);
    } else {
      setSuggestions([]);
    }
  }, [status, lastMessage]);

  return suggestions;
};