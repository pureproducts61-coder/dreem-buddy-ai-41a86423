CREATE TABLE IF NOT EXISTS public.admin_email_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_email_allowlist TO authenticated;
GRANT ALL ON public.admin_email_allowlist TO service_role;
ALTER TABLE public.admin_email_allowlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage admin email allowlist" ON public.admin_email_allowlist;
CREATE POLICY "Admins manage admin email allowlist"
ON public.admin_email_allowlist
FOR ALL
TO authenticated
USING (public.get_my_role() = 'admin')
WITH CHECK (public.get_my_role() = 'admin');

INSERT INTO public.admin_email_allowlist (email, label)
VALUES ('sheikhrazwan1110@gmail.com', 'Super admin')
ON CONFLICT (email) DO UPDATE SET label = EXCLUDED.label;

INSERT INTO public.user_profiles (user_id, email, role, approved, approval_status, approved_at, last_active)
SELECT au.id, au.email, 'admin', true, 'approved', now(), now()
FROM auth.users au
WHERE lower(au.email) = 'sheikhrazwan1110@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  role = 'admin',
  approved = true,
  approval_status = 'approved',
  approved_at = COALESCE(public.user_profiles.approved_at, now()),
  last_active = now();