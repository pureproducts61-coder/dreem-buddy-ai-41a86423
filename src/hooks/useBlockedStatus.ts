import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const db = supabase as unknown as { from: (t: string) => any };

export function useBlockedStatus(): { blocked: boolean; reason: string | null; loading: boolean } {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!user?.id) { setLoading(false); return; }
      const { data } = await db.from('user_blocks').select('reason').eq('user_id', user.id).maybeSingle();
      if (cancelled) return;
      setBlocked(!!data);
      setReason((data as { reason: string } | null)?.reason || null);
      setLoading(false);
    }
    check();
    // Realtime
    const channel = supabase
      .channel(`block-${user?.id || 'anon'}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'user_blocks', filter: `user_id=eq.${user?.id}` },
        check,
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [user?.id]);

  return { blocked, reason, loading };
}
