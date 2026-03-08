import { supabase } from '@/integrations/supabase/client';

export interface ChatSession {
  id: string;
  user_id: string;
  mode: 'build' | 'automation' | 'plan';
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export const chatPersistence = {
  async getOrCreateSession(mode: 'build' | 'automation' | 'plan'): Promise<ChatSession | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get latest session for this mode
    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('mode', mode)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (sessions && sessions.length > 0) {
      return sessions[0] as unknown as ChatSession;
    }

    // Create new session
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ user_id: user.id, mode, title: `${mode} session` })
      .select()
      .single();

    if (error) {
      console.error('Failed to create session:', error);
      return null;
    }
    return data as unknown as ChatSession;
  },

  async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to load messages:', error);
      return [];
    }
    return (data || []) as unknown as ChatMessage[];
  },

  async saveMessage(sessionId: string, role: 'user' | 'assistant', content: string): Promise<ChatMessage | null> {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ session_id: sessionId, role, content })
      .select()
      .single();

    if (error) {
      console.error('Failed to save message:', error);
      return null;
    }

    // Update session timestamp
    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return data as unknown as ChatMessage;
  },

  async updateMessage(messageId: string, content: string): Promise<void> {
    await supabase
      .from('chat_messages')
      .update({ content })
      .eq('id', messageId);
  },

  async getSessions(mode?: string): Promise<ChatSession[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (mode) {
      query = query.eq('mode', mode);
    }

    const { data } = await query;
    return (data || []) as unknown as ChatSession[];
  },

  async deleteSession(sessionId: string): Promise<void> {
    await supabase.from('chat_sessions').delete().eq('id', sessionId);
  },

  async createNewSession(mode: 'build' | 'automation' | 'plan', title?: string): Promise<ChatSession | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ user_id: user.id, mode, title: title || `${mode} session` })
      .select()
      .single();

    if (error) {
      console.error('Failed to create session:', error);
      return null;
    }
    return data as unknown as ChatSession;
  },
};
