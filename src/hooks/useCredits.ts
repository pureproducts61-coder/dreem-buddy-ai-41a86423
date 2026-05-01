import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getMyCredits } from '@/services/creditsService';

export function useCredits() {
  const { user, isAdmin } = useAuth();
  const [credits, setCredits] = useState<number>(isAdmin ? Infinity : 0);

  const refresh = useCallback(async () => {
    const c = await getMyCredits();
    setCredits(c);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    refresh();
    const channel = supabase
      .channel(`credits-${user.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const newRow = payload.new;
          if (newRow?.role === 'admin') setCredits(Infinity);
          else setCredits(Number(newRow?.credits ?? 0));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, refresh]);

  return { credits, refresh, isAdmin };
}
