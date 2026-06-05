ALTER TABLE public.user_profiles
  ALTER COLUMN approved SET DEFAULT true,
  ALTER COLUMN approval_status SET DEFAULT 'approved';

UPDATE public.user_profiles
SET approved = true,
    approval_status = 'approved',
    approved_at = COALESCE(approved_at, now())
WHERE approved = false OR approval_status <> 'approved';

UPDATE public.user_profiles
SET role = 'admin',
    approved = true,
    approval_status = 'approved',
    approved_at = COALESCE(approved_at, now())
WHERE lower(email) = 'sheikhrazwan1110@gmail.com';