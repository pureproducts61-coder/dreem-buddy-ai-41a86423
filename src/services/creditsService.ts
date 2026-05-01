// Credit tracking + deduction
import { supabase } from '@/integrations/supabase/client';

const db = supabase as unknown as { rpc: (n: string, a?: any) => any; from: (t: string) => any };

export const CREDIT_COST_PER_MESSAGE = 1;

export async function getMyCredits(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data } = await db.from('user_profiles')
    .select('credits, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!data) return 0;
  if (data.role === 'admin') return Infinity;
  return Number(data.credits ?? 0);
}

/** Atomically deduct N credits. Throws INSUFFICIENT_CREDITS when balance too low. Returns new balance. */
export async function deductCredits(amount = CREDIT_COST_PER_MESSAGE, reason = 'ai_message'): Promise<number> {
  const { data, error } = await db.rpc('deduct_credits', { amount, reason });
  if (error) {
    if (String(error.message || '').includes('INSUFFICIENT_CREDITS')) {
      throw new Error('INSUFFICIENT_CREDITS');
    }
    throw error;
  }
  return Number(data);
}
