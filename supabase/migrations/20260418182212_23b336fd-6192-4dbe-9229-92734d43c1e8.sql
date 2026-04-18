-- Function to promote a user to admin if their email matches the configured ADMIN_EMAIL
-- This is called from an edge function which has access to the ADMIN_EMAIL secret
CREATE OR REPLACE FUNCTION public.promote_admin_by_email(target_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_uid uuid;
  current_role text;
BEGIN
  -- Find the user by email
  SELECT id INTO target_uid FROM auth.users WHERE email = target_email LIMIT 1;
  
  IF target_uid IS NULL THEN
    RETURN 'user_not_found';
  END IF;
  
  -- Ensure profile exists
  INSERT INTO public.user_profiles (user_id, email, role)
  VALUES (target_uid, target_email, 'admin')
  ON CONFLICT (user_id) DO UPDATE SET
    role = 'admin',
    last_active = now(),
    email = EXCLUDED.email;
    
  RETURN 'promoted';
END;
$$;

-- Function the client can call to check & sync own role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_role text;
BEGIN
  SELECT role INTO my_role FROM public.user_profiles WHERE user_id = auth.uid();
  RETURN COALESCE(my_role, 'user');
END;
$$;