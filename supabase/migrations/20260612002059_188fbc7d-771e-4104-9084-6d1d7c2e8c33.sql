
-- Harden INSERT WITH CHECK on user-owned tables (defense-in-depth)
DROP POLICY IF EXISTS "Users insert own secrets" ON public.user_secrets;
CREATE POLICY "Users insert own secrets" ON public.user_secrets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can send messages to admin" ON public.admin_messages;
CREATE POLICY "Users can send messages to admin" ON public.admin_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admin → User direct notification
CREATE OR REPLACE FUNCTION public.admin_send_user_notification(
  target_user_id uuid,
  notif_title text,
  notif_body text,
  notif_type text DEFAULT 'info'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF public.get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'admin_only';
  END IF;
  IF target_user_id IS NULL OR notif_title IS NULL OR length(notif_title) = 0 THEN
    RAISE EXCEPTION 'invalid_input';
  END IF;
  IF length(notif_title) > 200 OR length(COALESCE(notif_body, '')) > 4000 THEN
    RAISE EXCEPTION 'too_long';
  END IF;

  INSERT INTO public.ai_notifications (title, body, type, metadata)
  VALUES (
    notif_title,
    notif_body,
    COALESCE(notif_type, 'info'),
    jsonb_build_object(
      'audience', 'user',
      'user_id', target_user_id::text,
      'from', 'admin',
      'admin_id', auth.uid()::text
    )
  )
  RETURNING id INTO new_id;

  INSERT INTO public.admin_audit_log (actor_id, event_type, target_table, target_id, after, note)
  VALUES (auth.uid(), 'admin.notify_user', 'ai_notifications', new_id::text,
          jsonb_build_object('target_user_id', target_user_id, 'title', notif_title), left(notif_title, 120));

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_send_user_notification(uuid, text, text, text) TO authenticated;

-- Per-user activity feed for the admin user-management drill-down
CREATE OR REPLACE FUNCTION public.admin_list_user_activity(
  target_user_id uuid,
  max_rows integer DEFAULT 50
) RETURNS TABLE (
  kind text,
  occurred_at timestamptz,
  title text,
  detail text,
  metadata jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  RETURN QUERY
  (
    SELECT 'project'::text, p.created_at, p.name, COALESCE(p.description, p.type),
           jsonb_build_object('project_id', p.id, 'status', p.status, 'type', p.type)
    FROM public.user_projects p WHERE p.user_id = target_user_id
    ORDER BY p.created_at DESC LIMIT max_rows
  )
  UNION ALL
  (
    SELECT 'credit'::text, c.created_at, c.action, COALESCE(c.description, ''),
           jsonb_build_object('amount', c.amount)
    FROM public.credit_usage c WHERE c.user_id = target_user_id
    ORDER BY c.created_at DESC LIMIT max_rows
  )
  UNION ALL
  (
    SELECT 'audit'::text, a.created_at, a.event_type, COALESCE(a.note, ''),
           jsonb_build_object('target_table', a.target_table, 'target_id', a.target_id)
    FROM public.admin_audit_log a
    WHERE a.actor_id = target_user_id
       OR a.target_id = target_user_id::text
    ORDER BY a.created_at DESC LIMIT max_rows
  )
  UNION ALL
  (
    SELECT 'message'::text, m.created_at, m.subject, left(m.message, 200),
           jsonb_build_object('category', m.category, 'status', m.status)
    FROM public.admin_messages m WHERE m.user_id = target_user_id
    ORDER BY m.created_at DESC LIMIT max_rows
  )
  ORDER BY 2 DESC
  LIMIT max_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_user_activity(uuid, integer) TO authenticated;
