ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS approved_by uuid,
ADD COLUMN IF NOT EXISTS approval_note text;

ALTER TABLE public.user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_approval_status_check;

ALTER TABLE public.user_profiles
ADD CONSTRAINT user_profiles_approval_status_check
CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));

UPDATE public.user_profiles
SET approved = true,
    approval_status = 'approved',
    approved_at = COALESCE(approved_at, now())
WHERE role = 'admin';

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND role = (SELECT up.role FROM public.user_profiles up WHERE up.user_id = auth.uid())
  AND credits = (SELECT up.credits FROM public.user_profiles up WHERE up.user_id = auth.uid())
  AND approved = (SELECT up.approved FROM public.user_profiles up WHERE up.user_id = auth.uid())
  AND approval_status = (SELECT up.approval_status FROM public.user_profiles up WHERE up.user_id = auth.uid())
  AND approved_at IS NOT DISTINCT FROM (SELECT up.approved_at FROM public.user_profiles up WHERE up.user_id = auth.uid())
  AND approved_by IS NOT DISTINCT FROM (SELECT up.approved_by FROM public.user_profiles up WHERE up.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.admin_update_user_access(
  target_user_id uuid,
  new_credits integer DEFAULT NULL,
  new_approved boolean DEFAULT NULL,
  new_approval_status text DEFAULT NULL,
  block_user boolean DEFAULT NULL,
  block_reason text DEFAULT NULL,
  admin_note text DEFAULT NULL
)
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_profile public.user_profiles;
  target_is_admin boolean;
BEGIN
  IF public.get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can update user access';
  END IF;

  SELECT (role = 'admin') INTO target_is_admin
  FROM public.user_profiles
  WHERE user_id = target_user_id;

  IF target_is_admin AND COALESCE(new_approved, true) = false THEN
    RAISE EXCEPTION 'Admin access cannot be suspended';
  END IF;

  UPDATE public.user_profiles
  SET credits = COALESCE(new_credits, credits),
      approved = CASE WHEN role = 'admin' THEN true ELSE COALESCE(new_approved, approved) END,
      approval_status = CASE
        WHEN role = 'admin' THEN 'approved'
        WHEN new_approval_status IS NOT NULL THEN new_approval_status
        WHEN new_approved IS TRUE THEN 'approved'
        WHEN new_approved IS FALSE THEN 'suspended'
        ELSE approval_status
      END,
      approved_at = CASE
        WHEN role = 'admin' THEN COALESCE(approved_at, now())
        WHEN COALESCE(new_approved, approved) IS TRUE AND approved_at IS NULL THEN now()
        ELSE approved_at
      END,
      approved_by = CASE
        WHEN role = 'admin' THEN COALESCE(approved_by, auth.uid())
        WHEN COALESCE(new_approved, approved) IS TRUE THEN auth.uid()
        ELSE approved_by
      END,
      approval_note = COALESCE(admin_note, approval_note),
      updated_at = now()
  WHERE user_id = target_user_id
  RETURNING * INTO updated_profile;

  IF updated_profile.user_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF block_user IS TRUE THEN
    INSERT INTO public.user_blocks (user_id, blocked_by, reason)
    VALUES (target_user_id, auth.uid(), block_reason)
    ON CONFLICT (user_id) DO UPDATE
    SET reason = EXCLUDED.reason, blocked_by = auth.uid();
  ELSIF block_user IS FALSE THEN
    DELETE FROM public.user_blocks WHERE user_id = target_user_id;
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, event_type, target_table, target_id, after, note)
  VALUES (auth.uid(), 'user_access.updated', 'user_profiles', target_user_id::text, to_jsonb(updated_profile), admin_note);

  RETURN updated_profile;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_user_on_admin_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.admin_reply IS NOT NULL
     AND NEW.admin_reply <> ''
     AND NEW.admin_reply IS DISTINCT FROM OLD.admin_reply THEN
    INSERT INTO public.ai_notifications (title, body, type, metadata)
    VALUES (
      'Admin replied to your message',
      NEW.admin_reply,
      'success',
      jsonb_build_object(
        'audience', 'user',
        'user_id', NEW.user_id,
        'message_id', NEW.id,
        'subject', NEW.subject,
        'category', NEW.category
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_user_on_admin_reply ON public.admin_messages;
CREATE TRIGGER trg_notify_user_on_admin_reply
AFTER UPDATE ON public.admin_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_user_on_admin_reply();

GRANT EXECUTE ON FUNCTION public.admin_update_user_access(uuid, integer, boolean, text, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_access(uuid, integer, boolean, text, boolean, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_access(uuid, integer, boolean, text, boolean, text, text) FROM anon, public;

REVOKE EXECUTE ON FUNCTION public.notify_user_on_admin_reply() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.notify_user_on_admin_reply() TO service_role;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, public;

COMMENT ON FUNCTION public.get_my_role() IS 'SECURITY DEFINER intentionally used by RLS policies to resolve caller role without recursive policy reads. Public/anon execute revoked; authenticated execute is required for RLS/RPC authorization checks.';
COMMENT ON FUNCTION public.deduct_credits(integer, text) IS 'SECURITY DEFINER intentionally callable by authenticated users and the chat edge function for atomic credit deduction. Admin users return unlimited access; non-admin users are charged server-side.';
COMMENT ON FUNCTION public.ensure_user_profile() IS 'SECURITY DEFINER intentionally callable by authenticated users to bootstrap their own profile using auth.uid and auth email.';
COMMENT ON FUNCTION public.is_user_blocked(uuid) IS 'SECURITY DEFINER intentionally callable by authenticated users to check block status without exposing user_blocks rows.';
COMMENT ON FUNCTION public.admin_list_profiles() IS 'SECURITY DEFINER intentionally callable by authenticated users but internally restricted to get_my_role() = admin.';
COMMENT ON FUNCTION public.admin_update_credits(uuid, integer) IS 'SECURITY DEFINER intentionally callable by authenticated users but internally restricted to get_my_role() = admin.';
COMMENT ON FUNCTION public.admin_update_user_access(uuid, integer, boolean, text, boolean, text, text) IS 'SECURITY DEFINER intentionally callable by authenticated users but internally restricted to get_my_role() = admin for user approval, credit, and block controls.';
COMMENT ON FUNCTION public.admin_block_user(uuid, text) IS 'SECURITY DEFINER intentionally callable by authenticated users but internally restricted to get_my_role() = admin.';
COMMENT ON FUNCTION public.admin_unblock_user(uuid) IS 'SECURITY DEFINER intentionally callable by authenticated users but internally restricted to get_my_role() = admin.';
COMMENT ON FUNCTION public.admin_list_messages() IS 'SECURITY DEFINER intentionally callable by authenticated users but internally restricted to get_my_role() = admin.';
COMMENT ON FUNCTION public.admin_list_user_projects() IS 'SECURITY DEFINER intentionally callable by authenticated users but internally restricted to get_my_role() = admin.';
COMMENT ON FUNCTION public.admin_dashboard_stats() IS 'SECURITY DEFINER intentionally callable by authenticated users but internally restricted to get_my_role() = admin.';
COMMENT ON FUNCTION public.promote_admin_by_email(text) IS 'SECURITY DEFINER intentionally callable by authenticated users but internally restricted to get_my_role() = admin.';
COMMENT ON FUNCTION public.log_kill_switch_change() IS 'Trigger-only SECURITY DEFINER; direct anon/authenticated/public execute revoked.';
COMMENT ON FUNCTION public.log_approval_change() IS 'Trigger-only SECURITY DEFINER; direct anon/authenticated/public execute revoked.';
COMMENT ON FUNCTION public.notify_user_on_admin_reply() IS 'Trigger-only SECURITY DEFINER; direct anon/authenticated/public execute revoked.';