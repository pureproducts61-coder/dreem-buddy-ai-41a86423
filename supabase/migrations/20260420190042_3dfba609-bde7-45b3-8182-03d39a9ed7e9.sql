-- ============================================================
-- 1. USER BLOCKS — admin can block users
-- ============================================================
CREATE TABLE public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  blocked_by uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can check if THEY are blocked (read own row)
CREATE POLICY "Users can read own block status"
  ON public.user_blocks FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin-only management is via SECURITY DEFINER functions below
-- (no direct INSERT/UPDATE/DELETE policy — must go through admin_block_user)

-- ============================================================
-- 2. ADMIN MESSAGES — users send messages to admins
-- ============================================================
CREATE TABLE public.admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text,
  category text NOT NULL DEFAULT 'feedback',
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'unread',
  admin_reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

-- Users can insert their own messages
CREATE POLICY "Users can send messages to admin"
  ON public.admin_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can read their own messages (to see admin reply)
CREATE POLICY "Users can read own messages"
  ON public.admin_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.get_my_role() = 'admin');

-- Only admins can update (mark handled, reply)
CREATE POLICY "Admins can update messages"
  ON public.admin_messages FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ============================================================
-- 3. AI NOTIFICATIONS — system/AI generated reports for admins
-- ============================================================
CREATE TABLE public.ai_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  metadata jsonb DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_notifications ENABLE ROW LEVEL SECURITY;

-- Admin-only read
CREATE POLICY "Admins can read notifications"
  ON public.ai_notifications FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');

-- Admin-only insert (system also via service role bypasses RLS)
CREATE POLICY "Admins can create notifications"
  ON public.ai_notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() = 'admin');

-- Admin-only update (mark read)
CREATE POLICY "Admins can update notifications"
  ON public.ai_notifications FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ============================================================
-- 4. USER PROJECTS — track what users are building
-- ============================================================
CREATE TABLE public.user_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  type text DEFAULT 'web',
  status text DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_projects_user_id ON public.user_projects(user_id);
CREATE INDEX idx_user_projects_updated ON public.user_projects(updated_at DESC);

ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;

-- Users manage their own projects, admins can read all
CREATE POLICY "Users manage own projects"
  ON public.user_projects FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR public.get_my_role() = 'admin')
  WITH CHECK (user_id = auth.uid() OR public.get_my_role() = 'admin');

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_projects_updated
  BEFORE UPDATE ON public.user_projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_admin_messages_updated
  BEFORE UPDATE ON public.admin_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 5. ADMIN HELPER FUNCTIONS
-- ============================================================

-- Check blocked status (any user can call for self; admin for any)
CREATE OR REPLACE FUNCTION public.is_user_blocked(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_blocks WHERE user_id = target_user_id);
$$;

-- Admin: block a user
CREATE OR REPLACE FUNCTION public.admin_block_user(target_user_id uuid, block_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can block users';
  END IF;
  INSERT INTO public.user_blocks (user_id, blocked_by, reason)
  VALUES (target_user_id, auth.uid(), block_reason)
  ON CONFLICT (user_id) DO UPDATE SET reason = EXCLUDED.reason, blocked_by = auth.uid();
END;
$$;

-- Admin: unblock a user
CREATE OR REPLACE FUNCTION public.admin_unblock_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can unblock users';
  END IF;
  DELETE FROM public.user_blocks WHERE user_id = target_user_id;
END;
$$;

-- Admin: dashboard stats
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF public.get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can view dashboard stats';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM public.user_profiles),
    'active_24h', (SELECT COUNT(*) FROM public.user_profiles WHERE last_active > now() - interval '24 hours'),
    'active_now', (SELECT COUNT(*) FROM public.user_profiles WHERE last_active > now() - interval '5 minutes'),
    'blocked_users', (SELECT COUNT(*) FROM public.user_blocks),
    'total_projects', (SELECT COUNT(*) FROM public.user_projects),
    'projects_24h', (SELECT COUNT(*) FROM public.user_projects WHERE created_at > now() - interval '24 hours'),
    'unread_messages', (SELECT COUNT(*) FROM public.admin_messages WHERE status = 'unread'),
    'unread_notifications', (SELECT COUNT(*) FROM public.ai_notifications WHERE read = false)
  ) INTO result;

  RETURN result;
END;
$$;

-- Admin: list all messages with user info
CREATE OR REPLACE FUNCTION public.admin_list_messages()
RETURNS SETOF public.admin_messages
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.admin_messages
  WHERE public.get_my_role() = 'admin'
  ORDER BY created_at DESC;
$$;

-- Admin: list all user projects (joined with email)
CREATE OR REPLACE FUNCTION public.admin_list_user_projects()
RETURNS TABLE(
  id uuid, user_id uuid, user_email text,
  name text, description text, type text, status text,
  created_at timestamptz, updated_at timestamptz, blocked boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.user_id, up.email AS user_email,
    p.name, p.description, p.type, p.status,
    p.created_at, p.updated_at,
    EXISTS(SELECT 1 FROM public.user_blocks b WHERE b.user_id = p.user_id) AS blocked
  FROM public.user_projects p
  LEFT JOIN public.user_profiles up ON up.user_id = p.user_id
  WHERE public.get_my_role() = 'admin'
  ORDER BY p.updated_at DESC;
$$;