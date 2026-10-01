DROP POLICY IF EXISTS authenticated_read_task_routing ON public.ai_task_routing;

CREATE POLICY admin_read_task_routing
ON public.ai_task_routing
FOR SELECT
TO authenticated
USING (public.get_my_role() = 'admin');