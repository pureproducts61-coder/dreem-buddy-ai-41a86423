-- USER SECRETS VAULT (per-user key/value secrets)
CREATE TABLE IF NOT EXISTS public.user_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  value text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.user_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own secrets" ON public.user_secrets
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own secrets" ON public.user_secrets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own secrets" ON public.user_secrets
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own secrets" ON public.user_secrets
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER touch_user_secrets BEFORE UPDATE ON public.user_secrets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- CREDIT DEDUCTION HELPER (atomic)
CREATE OR REPLACE FUNCTION public.deduct_credits(amount integer, reason text DEFAULT 'ai_message')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_credits integer;
  new_balance integer;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  -- Admins are not charged
  IF (SELECT role FROM public.user_profiles WHERE user_id = uid) = 'admin' THEN
    RETURN 999999;
  END IF;
  SELECT credits INTO current_credits FROM public.user_profiles WHERE user_id = uid FOR UPDATE;
  IF current_credits IS NULL THEN
    -- bootstrap profile
    INSERT INTO public.user_profiles (user_id, email)
    VALUES (uid, (SELECT email FROM auth.users WHERE id = uid))
    ON CONFLICT (user_id) DO NOTHING;
    SELECT credits INTO current_credits FROM public.user_profiles WHERE user_id = uid FOR UPDATE;
  END IF;
  IF current_credits < amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS' USING ERRCODE = 'P0001';
  END IF;
  new_balance := current_credits - amount;
  UPDATE public.user_profiles SET credits = new_balance, last_active = now() WHERE user_id = uid;
  INSERT INTO public.credit_usage (user_id, action, amount, description)
  VALUES (uid, reason, amount, NULL);
  RETURN new_balance;
END;
$$;

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;
ALTER TABLE public.admin_messages REPLICA IDENTITY FULL;
ALTER TABLE public.ai_notifications REPLICA IDENTITY FULL;
ALTER TABLE public.user_projects REPLICA IDENTITY FULL;
ALTER TABLE public.user_profiles REPLICA IDENTITY FULL;