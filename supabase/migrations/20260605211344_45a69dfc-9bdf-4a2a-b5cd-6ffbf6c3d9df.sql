
-- 1. Lock down credit_usage writes to SECURITY DEFINER paths only
DROP POLICY IF EXISTS "Users can insert own credit usage" ON public.credit_usage;
REVOKE INSERT ON public.credit_usage FROM authenticated, anon;

-- 2. Restrict system_controls SELECT to admins, expose safe boolean via RPC
DROP POLICY IF EXISTS "Anyone authenticated can read kill switch" ON public.system_controls;
CREATE POLICY "Admins can read kill switch"
  ON public.system_controls FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE OR REPLACE FUNCTION public.get_kill_switch_state()
RETURNS TABLE(kill_switch boolean, reason text, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.get_my_role() = 'admin';
BEGIN
  RETURN QUERY
  SELECT sc.kill_switch,
         CASE WHEN is_admin THEN sc.reason ELSE NULL END AS reason,
         sc.updated_at
  FROM public.system_controls sc
  WHERE sc.id = 'global';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_kill_switch_state() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_kill_switch_state() TO authenticated;
