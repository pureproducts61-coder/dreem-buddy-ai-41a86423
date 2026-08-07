-- 1. Shared AI OS config store (constitution, brain, plugins, capabilities, variables...)
CREATE TABLE IF NOT EXISTS public.ai_os_config (
  id text PRIMARY KEY,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_os_config TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ai_os_config TO authenticated;
GRANT ALL ON public.ai_os_config TO service_role;
ALTER TABLE public.ai_os_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_os_config_read ON public.ai_os_config;
CREATE POLICY ai_os_config_read ON public.ai_os_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS ai_os_config_admin_write ON public.ai_os_config;
CREATE POLICY ai_os_config_admin_write ON public.ai_os_config
  FOR ALL TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_os_config;
ALTER TABLE public.ai_os_config REPLICA IDENTITY FULL;

-- 2. Permission / capability access audit visible to the owner
CREATE TABLE IF NOT EXISTS public.permission_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  capability text NOT NULL,
  action text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  reason text,
  source text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.permission_audit TO authenticated;
GRANT ALL ON public.permission_audit TO service_role;
ALTER TABLE public.permission_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS permission_audit_own ON public.permission_audit;
CREATE POLICY permission_audit_own ON public.permission_audit
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.get_my_role() = 'admin');

DROP POLICY IF EXISTS permission_audit_insert_own ON public.permission_audit;
CREATE POLICY permission_audit_insert_own ON public.permission_audit
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS permission_audit_user_created_idx
  ON public.permission_audit (user_id, created_at DESC);

-- 3. Permanent system administrator
INSERT INTO public.admin_email_allowlist (email, label)
SELECT 'tivoaios@gmail.com', 'Permanent system administrator'
WHERE NOT EXISTS (SELECT 1 FROM public.admin_email_allowlist WHERE lower(email) = 'tivoaios@gmail.com');

UPDATE public.user_profiles
SET role = 'admin', approved = true, approval_status = 'approved', approved_at = COALESCE(approved_at, now())
WHERE lower(email) = 'tivoaios@gmail.com';

-- keep allowlisted emails admin on every profile bootstrap (existing admins untouched)
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uemail text;
  allowlisted boolean;
BEGIN
  SELECT email INTO uemail FROM auth.users WHERE id = auth.uid();
  SELECT EXISTS(SELECT 1 FROM public.admin_email_allowlist a WHERE lower(a.email) = lower(uemail)) INTO allowlisted;

  INSERT INTO public.user_profiles (user_id, email, role, approved, approval_status)
  VALUES (auth.uid(), uemail,
          CASE WHEN allowlisted THEN 'admin' ELSE 'user' END,
          COALESCE(allowlisted, false),
          CASE WHEN allowlisted THEN 'approved' ELSE 'pending' END)
  ON CONFLICT (user_id) DO UPDATE SET
    last_active = now(),
    email = EXCLUDED.email,
    role = CASE WHEN allowlisted THEN 'admin' ELSE public.user_profiles.role END,
    approved = CASE WHEN allowlisted THEN true ELSE public.user_profiles.approved END,
    approval_status = CASE WHEN allowlisted THEN 'approved' ELSE public.user_profiles.approval_status END;
END;
$function$;