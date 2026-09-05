// AI Chat Service - streams from edge function with tool calling support
import { getConfiguredCredentials } from './hybridStorageService';
import { getMemoryContext, addMemoryEntry } from './githubMemoryService';
import { supabase } from '@/integrations/supabase/client';
import { loadLocalSystemSettings, loadSystemSettingsFromDb } from './systemSettingsService';
import { buildSystemPrompt } from './os/constitution';
import { reloadAiConfig } from './os/dbSync';
import { pluginsPromptBlock } from './os/plugins';
import { brainPromptBlock } from './os/brain';
import { getDevices, deviceId } from './os/deviceRegistry';
import { capabilitiesPromptBlock, detectCapabilities } from './os/capabilities';
import { orchestrationPromptBlock, listMissingModelNotices } from './os/orchestrator';
import { toolsPromptBlock } from './os/toolRouter';
import { modelRoutingPromptBlock } from './os/modelRouter';
import { runtimePromptBlock } from './os/runtimeManager';
import { runLocalEngines, setActiveEngine } from './os/engineRouter';
import { pickProviderForTask, markProviderFailed } from './aiRouter';
import { systemStatusPromptBlock } from './os/systemStatus';
import { logRecoveryEvent, notifyAdminOfIssue } from './recoveryService';
const STORAGE_KEY = 'dreem-settings';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolEvent {
  type: 'tool_start' | 'tool_result' | 'thinking';
  tool: string;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  thinking?: { step: number; maxSteps: number; status: string; message?: string };
}

function getSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

async function getRuntimeSettings() {
  // NON-SECRET runtime preferences only. Provider API keys, GitHub/Vercel/Tavily
  // tokens are never read into the client and never leave the server boundary —
  // the chat Edge Function resolves them from server-side secret storage.
  const local = { ...loadLocalSystemSettings(), ...getSettings() } as Record<string, string>;
  const remote = await loadSystemSettingsFromDb().catch(() => ({})) as Record<string, string>;
  const merged = { ...local, ...remote } as Record<string, string>;
  for (const k of Object.keys(merged)) {
    if (/key|token|secret|password/i.test(k)) delete merged[k];
  }
  return merged;
}

export function getActiveProvider(): string {
  const settings = getSettings();
  return settings.aiModel || 'gemini';
}

export function hasAnyAIConfig(): boolean {
  return true;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
  onToolEvent,
  userContext,
}: {
  messages: ChatMessage[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError?: (error: string) => void;
  onToolEvent?: (event: ToolEvent) => void;
  userContext?: { isAdmin: boolean; email?: string; userId?: string };
}) {
  const settings = await getRuntimeSettings();

  // Always answer with the newest database-defined intelligence (hot reload).
  await reloadAiConfig().catch(() => false);

  // Compose the live system prompt (constitution + brain + real capabilities).
  await detectCapabilities().catch(() => []);
  const capsBlock = capabilitiesPromptBlock();
  const modelsBlock = orchestrationPromptBlock();
  const toolsBlock = toolsPromptBlock();
  const routingBlock = await modelRoutingPromptBlock('chat').catch(() => '');
  const missing = listMissingModelNotices();
  // Real connected devices (never invented) so the AI can route work to the computer.
  const devicesBlock = getDevices().map((d) => {
    const ready = (d.capabilities || []).filter((c) => c.state === 'ready').map((c) => c.label).join(', ') || 'none';
    const models = (d.models || []).filter((m) => m.status === 'ready').map((m) => m.name).join(', ') || 'none';
    return `- ${d.name} (${d.platform || 'unknown'}, ${d.role})${d.device_id === deviceId() ? ' [this device]' : ''}: ${d.online ? 'online' : 'OFFLINE'} · ready: ${ready} · local models: ${models}`;
  }).join('\n');
  const statusBlock = await systemStatusPromptBlock().catch(() => '');
  const runtimeBlock = await runtimePromptBlock().catch(() => '');
  const systemPrompt = [
    buildSystemPrompt(),
    statusBlock ? `## REAL SYSTEM STATUS (authoritative — never claim beyond this)\n${statusBlock}` : '',
    runtimeBlock ? `## RUNTIME DETECTION (local first, cloud only as fallback)\n${runtimeBlock}` : '',
    brainPromptBlock() ? `## AI BRAIN\n${brainPromptBlock()}` : '',
    capsBlock ? `## DEVICE CAPABILITIES (only claim what is ready)\n${capsBlock}` : '',
    devicesBlock ? `## CONNECTED DEVICES (route work to a computer when it is online; never claim an offline device)\n${devicesBlock}` : '',
    modelsBlock ? `## LOCAL MODELS AVAILABLE\n${modelsBlock}` : '',
    toolsBlock ? `## TOOLS YOU CAN ROUTE (only these; a tool needs its capability ready and its permission granted)\n${toolsBlock}` : '',
    routingBlock ? `## MODEL ROUTING\n${routingBlock}` : '',
    missing.length ? `## MISSING LOCAL MODELS (tell the user, offer download or GGUF import, never fail silently)\n${missing.map((m) => `- ${m.task}: ${m.message}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');

  // 1 & 2 — local engines first. When local answers, the cloud is never touched.
  try {
    const handledLocally = await runLocalEngines(messages, onDelta, systemPrompt);
    if (handledLocally) { onDone(); return; }
  } catch { /* fall through to cloud engines */ }

  // 3 — cloud engines. The admin-managed provider registry (ai_provider_configs
  // + ai_task_routing) is the single source of truth for ordering, enabled
  // state, capabilities and fallbacks. No API key is ever attached client-side.
  const chain = await pickProviderForTask('chat').catch(() => []);
  const providerChain = chain.map((c) => ({
    configId: c.id,
    provider: c.provider,
    model: c.model,
    secretName: c.api_key_secret_name || undefined,
    baseUrl: c.base_url || undefined,
    maxTokens: c.max_tokens || undefined,
  }));
  const provider = providerChain[0]?.provider || String(settings.aiModel || 'gemini');
  const model = providerChain[0]?.model;

  // Non-secret capability flags only (which integrations are configured), never values.
  const credentials = getConfiguredCredentials();
  // Identity is derived server-side from the JWT — do NOT send client-supplied flags.
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    onError?.('Please sign in to use TIVO AI.');
    return;
  }

  // Inject AI memory context
  let messagesWithMemory = [...messages];
  try {
    const memoryCtx = await getMemoryContext();
    if (memoryCtx) {
      messagesWithMemory = [
        { role: 'user' as const, content: `[System Memory]\n${memoryCtx}` },
        ...messages,
      ];
    }
  } catch { /* ignore memory errors */ }

  if (!CHAT_URL || CHAT_URL.includes('undefined')) {
    await mockStreamResponse(messages, onDelta, onDone);
    return;
  }

  try {
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        messages: messagesWithMemory,
        provider,
        model,
        providerChain,
        credentials,
        constitution: systemPrompt,
        plugins: pluginsPromptBlock(),
      }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({ error: 'Unknown error' }));
      const errMsg = errData.error || `Error ${resp.status}`;
      setActiveEngine(null);
      if (providerChain[0]) markProviderFailed(providerChain[0].configId);
      await logRecoveryEvent('ai_http_error', { status: resp.status, error: errMsg, provider });
      await notifyAdminOfIssue('AI runtime error', `Provider: ${provider}\nStatus: ${resp.status}\nError: ${errMsg}`);
      if (onError) onError(errMsg);
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
        if (line.trim() === '') continue;

        // Handle custom SSE events
        if (line.startsWith('event: ')) {
          const eventType = line.slice(7).trim();
          const nextNewline = textBuffer.indexOf('\n');
          if (nextNewline === -1) {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
          let dataLine = textBuffer.slice(0, nextNewline);
          textBuffer = textBuffer.slice(nextNewline + 1);
          if (dataLine.endsWith('\r')) dataLine = dataLine.slice(0, -1);

          if (dataLine.startsWith('data: ')) {
            try {
              const payload = JSON.parse(dataLine.slice(6).trim());
              if (eventType === 'tool_start') {
                onToolEvent?.({ type: 'tool_start', tool: payload.tool, args: payload.args });
              } else if (eventType === 'tool_result') {
                onToolEvent?.({ type: 'tool_result', tool: payload.tool, result: payload.result });
              } else if (eventType === 'thinking') {
                onToolEvent?.({ type: 'thinking', tool: '', thinking: payload });
              } else if (eventType === 'error' && onError) {
                await logRecoveryEvent('ai_stream_error', { error: payload.error, provider });
                await notifyAdminOfIssue('AI stream error', `Provider: ${provider}\nError: ${payload.error}`);
                onError(payload.error);
              }
            } catch { /* skip */ }
          }
          continue;
        }

        if (line.startsWith(':')) continue;
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
    response = `আমি আপনার রিকোয়েস্ট বুঝতে পেরেছি! 🚀\n\nবর্তমানে আমি **মক মোডে** কাজ করছি। সম্পূর্ণ AI ক্ষমতা পেতে:\n\n1. **Settings** (⚙️) এ যান\n2. **API Keys** সেকশনে আপনার key যোগ করুন\n3. Gemini, Groq, বা DeepSeek — যেকোনো একটি দিলেই হবে`;
  }

  const words = response.split(' ');
  for (const word of words) {
    onDelta(word + ' ');
    await new Promise(r => setTimeout(r, 30 + Math.random() * 40));
  }
  onDone();
}