
REVOKE EXECUTE ON FUNCTION public.log_auth_event(text, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_emergency_contact_view(uuid[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_system_recovery_event(text, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.log_auth_event(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_emergency_contact_view(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_system_recovery_event(text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.log_auth_event(event text, detail jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  uemail text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'authenticated_only';
  END IF;
  IF event IS NULL OR length(event) = 0 OR length(event) > 80 THEN
    RAISE EXCEPTION 'invalid_event';
  END IF;
  SELECT email INTO uemail FROM public.user_profiles WHERE user_id = uid;
  INSERT INTO public.admin_audit_log (actor_id, actor_email, event_type, target_table, after, note)
  VALUES (uid, uemail, 'auth.' || event, 'auth.users', COALESCE(detail, '{}'::jsonb), event);
END
$function$;

CREATE POLICY "admins_manage_user_blocks" ON public.user_blocks
  FOR ALL TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Move pg_net to dedicated extensions schema (drop + recreate)
CREATE SCHEMA IF NOT EXISTS extensions;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

COMMENT ON COLUMN public.user_profiles.github_token IS 'DEPRECATED: store in public.user_secrets (name=github_token) instead. Plaintext storage discouraged.';
