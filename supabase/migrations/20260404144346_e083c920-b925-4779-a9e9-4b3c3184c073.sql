
-- User profiles table
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text,
  display_name text,
  role text NOT NULL DEFAULT 'user',
  credits integer NOT NULL DEFAULT 50,
  github_token text,
  last_active timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY "Users can read own profile" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin can read all profiles (via service role or function)
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Credit usage log
CREATE TABLE public.credit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  action text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own credit usage" ON public.credit_usage
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own credit usage" ON public.credit_usage
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Function to get or create profile
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email)
  VALUES (auth.uid(), (SELECT email FROM auth.users WHERE id = auth.uid()))
  ON CONFLICT (user_id) DO UPDATE SET
    last_active = now(),
    email = EXCLUDED.email;
END;
$$;

-- Admin function to list all profiles (security definer bypasses RLS)
CREATE OR REPLACE FUNCTION public.admin_list_profiles()
RETURNS SETOF public.user_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.user_profiles ORDER BY created_at DESC;
$$;

-- Admin function to update user credits
CREATE OR REPLACE FUNCTION public.admin_update_credits(target_user_id uuid, new_credits integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_profiles SET credits = new_credits, updated_at = now() WHERE user_id = target_user_id;
END;
$$;
