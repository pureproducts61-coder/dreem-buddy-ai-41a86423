
CREATE TABLE IF NOT EXISTS public.system_controls (
  id text PRIMARY KEY DEFAULT 'global',
  kill_switch boolean NOT NULL DEFAULT false,
  reason text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.system_controls (id) VALUES ('global') ON CONFLICT DO NOTHING;
ALTER TABLE public.system_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read kill switch" ON public.system_controls;
CREATE POLICY "Anyone authenticated can read kill switch"
  ON public.system_controls FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can update kill switch" ON public.system_controls;
CREATE POLICY "Admins can update kill switch"
  ON public.system_controls FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

CREATE TABLE IF NOT EXISTS public.automation_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text,
  action_type text NOT NULL,
  title text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
ALTER TABLE public.automation_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own approvals" ON public.automation_approvals;
CREATE POLICY "Users read own approvals"
  ON public.automation_approvals FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.get_my_role() = 'admin');
DROP POLICY IF EXISTS "Users insert own approvals" ON public.automation_approvals;
CREATE POLICY "Users insert own approvals"
  ON public.automation_approvals FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins update approvals" ON public.automation_approvals;
CREATE POLICY "Admins update approvals"
  ON public.automation_approvals FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.system_controls; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_approvals; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
