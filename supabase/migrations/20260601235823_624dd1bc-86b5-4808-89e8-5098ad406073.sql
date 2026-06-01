
-- 1. Add admin guards to RPCs
CREATE OR REPLACE FUNCTION public.admin_list_profiles()
 RETURNS SETOF user_profiles
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF public.get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can list profiles';
  END IF;
  RETURN QUERY SELECT * FROM public.user_profiles ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_credits(target_user_id uuid, new_credits integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF public.get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can update credits';
  END IF;
  UPDATE public.user_profiles SET credits = new_credits, updated_at = now() WHERE user_id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_admin_by_email(target_email text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  target_uid uuid;
BEGIN
  IF public.get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can promote users';
  END IF;
  SELECT id INTO target_uid FROM auth.users WHERE email = target_email LIMIT 1;
  IF target_uid IS NULL THEN
    RETURN 'user_not_found';
  END IF;
  INSERT INTO public.user_profiles (user_id, email, role)
  VALUES (target_uid, target_email, 'admin')
  ON CONFLICT (user_id) DO UPDATE SET
    role = 'admin',
    last_active = now(),
    email = EXCLUDED.email;
  RETURN 'promoted';
END;
$$;

-- 2. Prevent self privilege escalation via direct UPDATE on user_profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND role = (SELECT role FROM public.user_profiles WHERE user_id = auth.uid())
  AND credits = (SELECT credits FROM public.user_profiles WHERE user_id = auth.uid())
);

-- 3. Remove user_profiles (with github_token) from realtime broadcast
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_profiles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.user_profiles';
  END IF;
END $$;

-- 4. Lock down SECURITY DEFINER admin RPCs from anon; keep authenticated EXECUTE
--    so the internal admin guard runs. promote_admin_by_email also restricted.
REVOKE EXECUTE ON FUNCTION public.admin_list_profiles() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_credits(uuid, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.promote_admin_by_email(text) FROM anon, public;
