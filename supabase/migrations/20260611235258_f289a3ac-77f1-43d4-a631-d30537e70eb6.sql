
-- Allow deleting messages and notifications after they are read.

CREATE POLICY "Users can delete own messages" ON public.admin_messages
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can delete any message" ON public.admin_messages
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE POLICY "Users delete own reply notifications" ON public.ai_notifications
  FOR DELETE TO authenticated
  USING ((metadata->>'audience') = 'user' AND (metadata->>'user_id')::uuid = auth.uid());

CREATE POLICY "Admins can delete notifications" ON public.ai_notifications
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'admin');
