-- ──────────────────────────────────────────────────────────────
-- 1) Revoke EXECUTE from anon/public on every SECURITY DEFINER fn
-- ──────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.admin_list_messages()           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_credits(uuid,int)  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_user_profile()           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_user_projects()      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.promote_admin_by_email(text)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_role()                   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_user_blocked(uuid)           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_block_user(uuid,text)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_unblock_user(uuid)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_profiles()           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats()         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.deduct_credits(int,text)        FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_list_messages()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_credits(uuid,int)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_user_projects()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_admin_by_email(text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role()                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_blocked(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_block_user(uuid,text)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unblock_user(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_profiles()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(int,text)         TO authenticated;

-- ──────────────────────────────────────────────────────────────
-- 2) Admin Audit Log
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  event_type text NOT NULL,        -- e.g. 'kill_switch.toggle', 'approval.decided'
  target_table text,
  target_id text,
  before jsonb,
  after jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit log" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

-- (no insert/update/delete policies → only triggers/service-role can write)

CREATE INDEX IF NOT EXISTS idx_audit_created ON public.admin_audit_log(created_at DESC);

-- Trigger fn for kill-switch
CREATE OR REPLACE FUNCTION public.log_kill_switch_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_audit_log (actor_id, event_type, target_table, target_id, before, after, note)
  VALUES (
    auth.uid(),
    CASE WHEN NEW.kill_switch IS DISTINCT FROM OLD.kill_switch
         THEN 'kill_switch.toggle' ELSE 'kill_switch.update' END,
    'system_controls', NEW.id,
    to_jsonb(OLD), to_jsonb(NEW),
    NEW.reason
  );
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_log_kill_switch ON public.system_controls;
CREATE TRIGGER trg_log_kill_switch
  AFTER UPDATE ON public.system_controls
  FOR EACH ROW EXECUTE FUNCTION public.log_kill_switch_change();

-- Trigger fn for approvals
CREATE OR REPLACE FUNCTION public.log_approval_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.admin_audit_log (actor_id, actor_email, event_type, target_table, target_id, after, note)
    VALUES (NEW.user_id, NEW.user_email, 'approval.requested', 'automation_approvals', NEW.id::text, to_jsonb(NEW), NEW.title);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.admin_audit_log (actor_id, event_type, target_table, target_id, before, after, note)
    VALUES (auth.uid(), 'approval.' || NEW.status, 'automation_approvals', NEW.id::text, to_jsonb(OLD), to_jsonb(NEW), NEW.admin_note);
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_log_approval ON public.automation_approvals;
CREATE TRIGGER trg_log_approval
  AFTER INSERT OR UPDATE ON public.automation_approvals
  FOR EACH ROW EXECUTE FUNCTION public.log_approval_change();

-- Re-lock the new SECURITY DEFINER trigger fns
REVOKE EXECUTE ON FUNCTION public.log_kill_switch_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_approval_change()    FROM PUBLIC, anon, authenticated;