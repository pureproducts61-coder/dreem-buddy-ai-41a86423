-- 1. ai_os_config: shared runtime keys readable by signed-in users, everything else admin-only
DROP POLICY IF EXISTS "ai_os_config_read" ON public.ai_os_config;
CREATE POLICY "ai_os_config_read_shared"
ON public.ai_os_config
FOR SELECT
TO authenticated
USING (
  id = ANY (ARRAY['constitution'::text, 'brain'::text, 'plugins'::text])
  OR public.get_my_role() = 'admin'
);

-- 2. Trigger-only SECURITY DEFINER functions must never be callable through the API
REVOKE ALL ON FUNCTION public.log_admin_message_reply() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_emergency_contact_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_user_profile_sensitive() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_approval_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_kill_switch_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_system_settings_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_user_on_admin_reply() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- 3. Signed-out visitors must not be able to execute any privileged function
REVOKE EXECUTE ON FUNCTION public.admin_list_user_activity(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_permanent_delete_projects(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_send_user_notification(uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_block_user(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_messages() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_profiles() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_user_projects() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_unblock_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_credits(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_access(uuid, integer, boolean, text, boolean, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.deduct_credits(integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_user_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_kill_switch_state() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_user_blocked(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_auth_event(text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_emergency_contact_view(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_system_recovery_event(text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.promote_admin_by_email(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_ai_memory(extensions.vector, integer) FROM anon;

-- Admin-only entry points: keep them callable by signed-in admins (each one re-checks the role
-- internally), but never by signed-out visitors.
GRANT EXECUTE ON FUNCTION public.admin_list_user_activity(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_permanent_delete_projects(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_send_user_notification(uuid, text, text, text) TO authenticated;