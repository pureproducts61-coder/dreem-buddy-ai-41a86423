
-- 1) Admin reply audit on admin_messages
CREATE OR REPLACE FUNCTION public.log_admin_message_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.admin_reply IS DISTINCT FROM OLD.admin_reply
     AND NEW.admin_reply IS NOT NULL THEN
    INSERT INTO public.admin_audit_log (actor_id, event_type, target_table, target_id, before, after, note)
    VALUES (auth.uid(), 'admin_message.reply', 'admin_messages', NEW.id::text,
            to_jsonb(OLD), to_jsonb(NEW), left(NEW.admin_reply, 200));
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_log_admin_message_reply ON public.admin_messages;
CREATE TRIGGER trg_log_admin_message_reply
AFTER UPDATE ON public.admin_messages
FOR EACH ROW EXECUTE FUNCTION public.log_admin_message_reply();

-- 2) Emergency contact INSERT + UPDATE audit
CREATE OR REPLACE FUNCTION public.log_emergency_contact_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_audit_log (actor_id, actor_email, event_type, target_table, target_id, after, note)
    VALUES (NULL, NEW.email, 'emergency_contact.created', 'emergency_contacts', NEW.id::text,
            jsonb_build_object('email', NEW.email, 'subject', NEW.subject, 'source', NEW.source), NEW.subject);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.admin_audit_log (actor_id, event_type, target_table, target_id, before, after, note)
    VALUES (auth.uid(), 'emergency_contact.' || NEW.status, 'emergency_contacts', NEW.id::text,
            jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status), NEW.subject);
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_log_emergency_contact_change ON public.emergency_contacts;
CREATE TRIGGER trg_log_emergency_contact_change
AFTER INSERT OR UPDATE ON public.emergency_contacts
FOR EACH ROW EXECUTE FUNCTION public.log_emergency_contact_change();

-- 3) RPC for admins to log read access to emergency contacts
CREATE OR REPLACE FUNCTION public.log_emergency_contact_view(target_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'admin_only';
  END IF;
  INSERT INTO public.admin_audit_log (actor_id, event_type, target_table, target_id, after, note)
  VALUES (auth.uid(), 'emergency_contact.viewed', 'emergency_contacts',
          COALESCE(array_to_string(target_ids, ','), 'all'),
          jsonb_build_object('count', COALESCE(array_length(target_ids,1), 0)),
          'admin viewed emergency contacts');
END$$;

GRANT EXECUTE ON FUNCTION public.log_emergency_contact_view(uuid[]) TO authenticated;

-- 4) RPC for auth events (called from client after login / logout / magic-link send)
CREATE OR REPLACE FUNCTION public.log_auth_event(event text, detail jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
BEGIN
  IF event IS NULL OR length(event) = 0 OR length(event) > 80 THEN
    RAISE EXCEPTION 'invalid_event';
  END IF;
  SELECT email INTO uemail FROM public.user_profiles WHERE user_id = uid;
  INSERT INTO public.admin_audit_log (actor_id, actor_email, event_type, target_table, after, note)
  VALUES (uid, uemail, 'auth.' || event, 'auth.users', detail, event);
END$$;

GRANT EXECUTE ON FUNCTION public.log_auth_event(text, jsonb) TO authenticated, anon;

-- 5) Sensitive user_profiles changes audit (role / credits / approval)
CREATE OR REPLACE FUNCTION public.log_user_profile_sensitive()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
       NEW.role IS DISTINCT FROM OLD.role
    OR NEW.credits IS DISTINCT FROM OLD.credits
    OR NEW.approved IS DISTINCT FROM OLD.approved
    OR NEW.approval_status IS DISTINCT FROM OLD.approval_status
  ) THEN
    INSERT INTO public.admin_audit_log (actor_id, event_type, target_table, target_id, before, after, note)
    VALUES (auth.uid(), 'user_profile.sensitive_change', 'user_profiles', NEW.user_id::text,
            jsonb_build_object('role', OLD.role, 'credits', OLD.credits, 'approved', OLD.approved, 'approval_status', OLD.approval_status),
            jsonb_build_object('role', NEW.role, 'credits', NEW.credits, 'approved', NEW.approved, 'approval_status', NEW.approval_status),
            NULL);
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_log_user_profile_sensitive ON public.user_profiles;
CREATE TRIGGER trg_log_user_profile_sensitive
AFTER UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.log_user_profile_sensitive();
