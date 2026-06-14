
ALTER TABLE public.ai_notifications
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

UPDATE public.ai_notifications
SET user_id = ((metadata ->> 'user_id')::uuid)
WHERE user_id IS NULL
  AND metadata ? 'user_id'
  AND (metadata ->> 'user_id') ~ '^[0-9a-fA-F-]{36}$';

CREATE INDEX IF NOT EXISTS ai_notifications_user_id_idx
  ON public.ai_notifications(user_id);

DROP POLICY IF EXISTS "Users read own reply notifications" ON public.ai_notifications;
DROP POLICY IF EXISTS "Users mark own reply notifications read" ON public.ai_notifications;
DROP POLICY IF EXISTS "Users delete own reply notifications" ON public.ai_notifications;

CREATE POLICY "Users read own notifications"
  ON public.ai_notifications FOR SELECT
  USING (
    public.get_my_role() = 'admin'
    OR (user_id IS NOT NULL AND user_id = auth.uid())
  );

CREATE POLICY "Users mark own notifications read"
  ON public.ai_notifications FOR UPDATE
  USING (user_id IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (user_id IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Users delete own notifications"
  ON public.ai_notifications FOR DELETE
  USING (user_id IS NOT NULL AND user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.admin_send_user_notification(
  target_user_id uuid,
  notif_title text,
  notif_body text,
  notif_type text DEFAULT 'info'::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  INSERT INTO public.ai_notifications (title, body, type, user_id, metadata)
  VALUES (
    notif_title, notif_body, COALESCE(notif_type, 'info'), target_user_id,
    jsonb_build_object('audience','user','user_id',target_user_id::text,'from','admin','admin_id',auth.uid()::text)
  )
  RETURNING id INTO new_id;

  INSERT INTO public.admin_audit_log (actor_id, event_type, target_table, target_id, after, note)
  VALUES (auth.uid(), 'admin.notify_user', 'ai_notifications', new_id::text,
          jsonb_build_object('target_user_id', target_user_id, 'title', notif_title), left(notif_title, 120));

  RETURN new_id;
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
    INSERT INTO public.ai_notifications (title, body, type, user_id, metadata)
    VALUES (
      'Admin replied to your message', NEW.admin_reply, 'success', NEW.user_id,
      jsonb_build_object('audience','user','user_id',NEW.user_id,'message_id',NEW.id,'subject',NEW.subject,'category',NEW.category)
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.user_profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.user_profiles FOR SELECT
  USING (public.get_my_role() = 'admin');
