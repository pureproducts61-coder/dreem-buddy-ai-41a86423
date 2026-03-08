// AI Chat Service - streams from edge function or falls back to mock
const STORAGE_KEY = 'dreem-settings';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function getSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function getApiKeyForProvider(provider: string): string {
  const settings = getSettings();
  switch (provider) {
    case 'gemini': return settings.geminiApiKey || '';
    case 'groq': return settings.groqApiKey || '';
    case 'deepseek': return settings.deepseekApiKey || '';
    default: return '';
  }
}

export function getActiveProvider(): string {
  const settings = getSettings();
  return settings.aiModel || 'gemini';
}

export function hasAnyAIConfig(): boolean {
  const settings = getSettings();
  // Check if any API key is configured
  return !!(settings.geminiApiKey || settings.groqApiKey || settings.deepseekApiKey);
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: ChatMessage[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError?: (error: string) => void;
}) {
  const provider = getActiveProvider();
  const apiKey = getApiKeyForProvider(provider);
  const settings = getSettings();
  const githubToken = settings.githubToken || '';

  // If no Supabase URL (shouldn't happen with Cloud), fall back to mock
  if (!CHAT_URL || CHAT_URL.includes('undefined')) {
    await mockStreamResponse(messages, onDelta, onDone);
    return;
  }

  try {
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        messages,
        provider,
        apiKey: apiKey || undefined,
        model: undefined,
        githubToken: githubToken || undefined,
      }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({ error: 'Unknown error' }));
      const errMsg = errData.error || `Error ${resp.status}`;
      if (onError) onError(errMsg);
      // Fall back to mock on error
      await mockStreamResponse(messages, onDelta, onDone);
      return;
    }

    if (!resp.body) {
      await mockStreamResponse(messages, onDelta, onDone);
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split('\n')) {
        if (!raw) continue;
        if (raw.endsWith('\r')) raw = raw.slice(0, -1);
        if (raw.startsWith(':') || raw.trim() === '') continue;
        if (!raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (e) {
    console.error('Stream chat error:', e);
    if (onError) onError(e instanceof Error ? e.message : 'Connection failed');
    // Fall back to mock
    await mockStreamResponse(messages, onDelta, onDone);
  }
}

// Mock response when no AI is configured
async function mockStreamResponse(
  messages: ChatMessage[],
  onDelta: (text: string) => void,
  onDone: () => void,
) {
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
  
  let response = '';
  if (lastMsg.includes('plan') || lastMsg.includes('প্ল্যান')) {
    response = `## প্রজেক্ট প্ল্যান\n\nআপনার প্রজেক্টের জন্য আমি নিচের প্ল্যান প্রস্তাব করছি:\n\n**Phase 1:** ফ্রন্টএন্ড — React + Tailwind\n**Phase 2:** ব্যাকএন্ড — API Integration\n**Phase 3:** ডাটাবেজ — PostgreSQL\n\n> ⚠️ এটি একটি মক রেসপন্স। সম্পূর্ণ AI ফিচার পেতে **Settings → API Keys**-এ আপনার Gemini/Groq API Key যোগ করুন।`;
  } else if (lastMsg.includes('build') || lastMsg.includes('বানা') || lastMsg.includes('তৈরি')) {
    response = `## কোড জেনারেশন\n\n\`\`\`tsx\nexport function Component() {\n  return (\n    <div className="p-4">\n      <h1>Hello TIVO!</h1>\n    </div>\n  );\n}\n\`\`\`\n\n> ⚠️ মক রেসপন্স। Real AI-এর জন্য Settings-এ API Key সেট করুন।`;
  } else {
    response = `আমি আপনার রিকোয়েস্ট বুঝতে পেরেছি! 🚀\n\nবর্তমানে আমি **মক মোডে** কাজ করছি। সম্পূর্ণ AI ক্ষমতা পেতে:\n\n1. **Settings** (⚙️) এ যান\n2. **API Keys** সেকশনে আপনার key যোগ করুন\n3. Gemini, Groq, বা DeepSeek — যেকোনো একটি দিলেই হবে\n\nতারপর আমি আপনার জন্য:\n- 📋 প্রজেক্ট প্ল্যান করবো\n- 💻 কোড জেনারেট করবো\n- 🔗 GitHub-এ পুশ করবো`;
  }

  // Simulate streaming word by word
  const words = response.split(' ');
  for (const word of words) {
    onDelta(word + ' ');
    await new Promise(r => setTimeout(r, 30 + Math.random() * 40));
  }
  onDone();
}
