// Hybrid Storage: uses Supabase when connected & authenticated, falls back to localStorage
import { supabase } from '@/integrations/supabase/client';
import { logRecoveryEvent } from './recoveryService';

const STORAGE_KEY = 'dreem-settings';
const LOCAL_SESSIONS_KEY = 'tivo-local-sessions';
const LOCAL_MESSAGES_KEY = 'tivo-local-messages';

function getSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

// Check if DB is truly usable (user is authenticated)
let _dbUsable: boolean | null = null;
let _dbCheckPromise: Promise<boolean> | null = null;

async function checkDbUsable(): Promise<boolean> {
  if (_dbUsable !== null) return _dbUsable;
  if (_dbCheckPromise) return _dbCheckPromise;

  _dbCheckPromise = (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      _dbUsable = !!user;
      return _dbUsable;
    } catch {
      _dbUsable = false;
      return false;
    }
  })();

  return _dbCheckPromise;
}

// Reset DB check on auth state change
supabase.auth.onAuthStateChange(() => {
  _dbUsable = null;
  _dbCheckPromise = null;
});

export function isDbConnected(): boolean {
  const settings = getSettings();
  const hasEnvDb = !!import.meta.env.VITE_SUPABASE_URL;
  const hasConfigDb = !!(settings.supabaseUrl && settings.supabaseAnonKey);
  return hasEnvDb || hasConfigDb;
}

export function getConfiguredCredentials(): Record<string, boolean> {
  const settings = getSettings();
  return {
    gemini: !!(settings.geminiApiKey),
    groq: !!(settings.groqApiKey),
    deepseek: !!(settings.deepseekApiKey),
    github: !!(settings.githubToken),
    vercel: !!(settings.vercelToken),
    tavily: !!(settings.tavilyApiKey),
    huggingface: !!(settings.hfToken),
    database: isDbConnected(),
    backend: !!(settings.backendUrl),
  };
}

// ── Local Storage CRUD for sessions/messages ──

interface LocalSession {
  id: string;
  user_id: string;
  mode: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface LocalMessage {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

function getLocalSessions(): LocalSession[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_SESSIONS_KEY) || '[]');
  } catch { return []; }
}

function saveLocalSessions(sessions: LocalSession[]) {
  localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(sessions));
}

function getLocalMessages(): LocalMessage[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_MESSAGES_KEY) || '[]');
  } catch { return []; }
}

function saveLocalMessages(messages: LocalMessage[]) {
  localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(messages));
}

// ── Hybrid Chat Persistence ──

export const hybridChatPersistence = {
  async getOrCreateSession(mode: string): Promise<LocalSession | null> {
    const dbOk = await checkDbUsable();
    if (dbOk) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return this._localGetOrCreateSession(mode, 'local-user');

        const { data: sessions } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('mode', mode)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (sessions && sessions.length > 0) return sessions[0] as unknown as LocalSession;

        const { data, error } = await supabase
          .from('chat_sessions')
          .insert({ user_id: user.id, mode, title: `${mode} session` })
          .select()
          .single();

        if (error) throw error;
        return data as unknown as LocalSession;
      } catch (e) {
        console.warn('DB failed, falling back to local:', e);
        void logRecoveryEvent('db_fallback.session', { mode, reason: e instanceof Error ? e.message : String(e) });
        return this._localGetOrCreateSession(mode, 'local-user');
      }
    }
    return this._localGetOrCreateSession(mode, 'local-user');
  },

  _localGetOrCreateSession(mode: string, userId: string): LocalSession {
    const sessions = getLocalSessions();
    const existing = sessions
      .filter(s => s.mode === mode && s.user_id === userId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    if (existing.length > 0) return existing[0];

    const newSession: LocalSession = {
      id: crypto.randomUUID(),
      user_id: userId,
      mode,
      title: `${mode} session`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    sessions.push(newSession);
    saveLocalSessions(sessions);
    return newSession;
  },

  async getMessages(sessionId: string): Promise<LocalMessage[]> {
    const dbOk = await checkDbUsable();
    if (dbOk) {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []) as unknown as LocalMessage[];
      } catch (e) {
        void logRecoveryEvent('db_fallback.messages', { sessionId, reason: e instanceof Error ? e.message : String(e) });
        return getLocalMessages().filter(m => m.session_id === sessionId).sort((a, b) => a.created_at.localeCompare(b.created_at));
      }
    }
    return getLocalMessages().filter(m => m.session_id === sessionId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  },

  async saveMessage(sessionId: string, role: string, content: string): Promise<LocalMessage | null> {
    // Always save locally first
    const localMsg = this._localSaveMessage(sessionId, role, content);

    const dbOk = await checkDbUsable();
    if (dbOk) {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .insert({ session_id: sessionId, role, content })
          .select()
          .single();
        if (error) throw error;

        await supabase
          .from('chat_sessions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', sessionId);

        return data as unknown as LocalMessage;
      } catch (e) {
        void logRecoveryEvent('db_fallback.save_message', { sessionId, role, reason: e instanceof Error ? e.message : String(e) });
        return localMsg;
      }
    }
    return localMsg;
  },

  _localSaveMessage(sessionId: string, role: string, content: string): LocalMessage {
    const msg: LocalMessage = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      role,
      content,
      created_at: new Date().toISOString(),
    };
    const messages = getLocalMessages();
    messages.push(msg);
    saveLocalMessages(messages);

    // Update session timestamp
    const sessions = getLocalSessions();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx !== -1) {
      sessions[idx].updated_at = new Date().toISOString();
      saveLocalSessions(sessions);
    }
    return msg;
  },

  async getSessions(mode?: string): Promise<LocalSession[]> {
    const dbOk = await checkDbUsable();
    if (dbOk) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return this._localGetSessions(mode);

        let query = supabase
          .from('chat_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (mode) query = query.eq('mode', mode);
        const { data } = await query;
        return (data || []) as unknown as LocalSession[];
      } catch {
        return this._localGetSessions(mode);
      }
    }
    return this._localGetSessions(mode);
  },

  _localGetSessions(mode?: string): LocalSession[] {
    let sessions = getLocalSessions();
    if (mode) sessions = sessions.filter(s => s.mode === mode);
    return sessions.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  },

  async deleteSession(sessionId: string): Promise<void> {
    const dbOk = await checkDbUsable();
    if (dbOk) {
      try {
        await supabase.from('chat_messages').delete().eq('session_id', sessionId);
        await supabase.from('chat_sessions').delete().eq('id', sessionId);
      } catch { /* fallback */ }
    }
    // Always clean local too
    saveLocalSessions(getLocalSessions().filter(s => s.id !== sessionId));
    saveLocalMessages(getLocalMessages().filter(m => m.session_id !== sessionId));
  },

  async createNewSession(mode: string, title?: string): Promise<LocalSession | null> {
    const dbOk = await checkDbUsable();
    if (dbOk) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return this._localCreateSession(mode, 'local-user', title);

        const { data, error } = await supabase
          .from('chat_sessions')
          .insert({ user_id: user.id, mode, title: title || `${mode} session` })
          .select()
          .single();
        if (error) throw error;
        return data as unknown as LocalSession;
      } catch {
        return this._localCreateSession(mode, 'local-user', title);
      }
    }
    return this._localCreateSession(mode, 'local-user', title);
  },

  _localCreateSession(mode: string, userId: string, title?: string): LocalSession {
    const session: LocalSession = {
      id: crypto.randomUUID(),
      user_id: userId,
      mode,
      title: title || `${mode} session`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const sessions = getLocalSessions();
    sessions.push(session);
    saveLocalSessions(sessions);
    return session;
  },

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    const dbOk = await checkDbUsable();
    if (dbOk) {
      try {
        await supabase.from('chat_sessions').update({ title }).eq('id', sessionId);
      } catch { /* fallback */ }
    }
    const sessions = getLocalSessions();
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx !== -1) {
      sessions[idx].title = title;
      saveLocalSessions(sessions);
    }
  },

  async updateMessage(messageId: string, content: string): Promise<void> {
    const dbOk = await checkDbUsable();
    if (dbOk) {
      try {
        await supabase.from('chat_messages').update({ content }).eq('id', messageId);
      } catch { /* fallback */ }
    }
    const messages = getLocalMessages();
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx !== -1) {
      messages[idx].content = content;
      saveLocalMessages(messages);
    }
  },
};
