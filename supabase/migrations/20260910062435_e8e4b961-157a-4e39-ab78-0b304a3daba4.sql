REVOKE ALL ON FUNCTION public.admin_send_user_notification(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_user_activity(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_permanent_delete_projects(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_send_user_notification(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_user_activity(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_permanent_delete_projects(uuid[]) TO authenticated;