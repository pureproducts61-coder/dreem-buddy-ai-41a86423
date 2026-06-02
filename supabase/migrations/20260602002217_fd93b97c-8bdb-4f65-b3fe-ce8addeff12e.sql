DROP POLICY IF EXISTS "Users read own reply notifications" ON public.ai_notifications;
CREATE POLICY "Users read own reply notifications"
ON public.ai_notifications
FOR SELECT
TO authenticated
USING (
  public.get_my_role() = 'admin'
  OR (
    metadata->>'audience' = 'user'
    AND metadata->>'user_id' = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "Users mark own reply notifications read" ON public.ai_notifications;
CREATE POLICY "Users mark own reply notifications read"
ON public.ai_notifications
FOR UPDATE
TO authenticated
USING (
  metadata->>'audience' = 'user'
  AND metadata->>'user_id' = auth.uid()::text
)
WITH CHECK (
  metadata->>'audience' = 'user'
  AND metadata->>'user_id' = auth.uid()::text
);