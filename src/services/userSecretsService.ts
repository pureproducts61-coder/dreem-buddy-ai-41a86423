// Per-user dynamic secrets vault (client-readable, RLS-protected)
import { supabase } from '@/integrations/supabase/client';

const db = supabase as unknown as { from: (t: string) => any };

export interface UserSecret {
  id: string;
  user_id: string;
  name: string;
  value: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export async function listUserSecrets(): Promise<UserSecret[]> {
  const { data, error } = await db.from('user_secrets').select('*').order('name');
  if (error) return [];
  return (data || []) as UserSecret[];
}

export async function upsertUserSecret(name: string, value: string, description?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await db.from('user_secrets').upsert(
    { user_id: user.id, name: name.trim(), value, description: description || null },
    { onConflict: 'user_id,name' },
  );
  if (error) throw error;
}

export async function deleteUserSecret(id: string): Promise<void> {
  const { error } = await db.from('user_secrets').delete().eq('id', id);
  if (error) throw error;
}

/** Read a single secret by name — used by the AI tool layer */
export async function getUserSecretValue(name: string): Promise<string | null> {
  const { data } = await db.from('user_secrets').select('value').eq('name', name).maybeSingle();
  return (data as { value: string } | null)?.value || null;
}
