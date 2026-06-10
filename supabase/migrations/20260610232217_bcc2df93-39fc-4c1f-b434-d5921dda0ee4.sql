CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT '',
  description text,
  is_secret boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage system settings" ON public.system_settings;
CREATE POLICY "Admins manage system settings"
  ON public.system_settings FOR ALL TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

CREATE TABLE IF NOT EXISTS public.admin_weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'generated',
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_weekly_reports TO authenticated;
GRANT ALL ON public.admin_weekly_reports TO service_role;
ALTER TABLE public.admin_weekly_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read weekly reports" ON public.admin_weekly_reports;
CREATE POLICY "Admins read weekly reports"
  ON public.admin_weekly_reports FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_secrets TO authenticated;
GRANT ALL ON public.user_secrets TO service_role;
GRANT SELECT, UPDATE ON public.system_controls TO authenticated;
GRANT ALL ON public.system_controls TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_approvals TO authenticated;
GRANT ALL ON public.automation_approvals TO service_role;
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_messages TO authenticated;
GRANT ALL ON public.admin_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_notifications TO authenticated;
GRANT ALL ON public.ai_notifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_sessions TO authenticated;
GRANT ALL ON public.chat_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_projects TO authenticated;
GRANT ALL ON public.user_projects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_usage TO authenticated;
GRANT ALL ON public.credit_usage TO service_role;

CREATE OR REPLACE FUNCTION public.log_system_recovery_event(event text, detail jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
BEGIN
  IF event IS NULL OR length(event) = 0 OR length(event) > 100 THEN
    RAISE EXCEPTION 'invalid_event';
  END IF;
  SELECT email INTO uemail FROM public.user_profiles WHERE user_id = uid;
  INSERT INTO public.admin_audit_log (actor_id, actor_email, event_type, target_table, after, note)
  VALUES (uid, uemail, 'recovery.' || event, 'system', COALESCE(detail, '{}'::jsonb), event);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_system_recovery_event(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_system_recovery_event(text, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.log_system_settings_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_audit_log (actor_id, event_type, target_table, target_id, after, note)
    VALUES (auth.uid(), 'system_settings.created', 'system_settings', NEW.key,
            jsonb_build_object('key', NEW.key, 'is_secret', NEW.is_secret, 'description', NEW.description), NEW.key);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.admin_audit_log (actor_id, event_type, target_table, target_id, before, after, note)
    VALUES (auth.uid(), 'system_settings.updated', 'system_settings', NEW.key,
            jsonb_build_object('key', OLD.key, 'had_value', OLD.value <> '', 'is_secret', OLD.is_secret),
            jsonb_build_object('key', NEW.key, 'has_value', NEW.value <> '', 'is_secret', NEW.is_secret), NEW.key);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_system_settings ON public.system_settings;
CREATE TRIGGER trg_log_system_settings
  AFTER INSERT OR UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_system_settings_change();
REVOKE EXECUTE ON FUNCTION public.log_system_settings_change() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN insufficient_privilege OR feature_not_supported THEN
  NULL;
END $$;
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN insufficient_privilege OR feature_not_supported THEN
  NULL;
END $$;