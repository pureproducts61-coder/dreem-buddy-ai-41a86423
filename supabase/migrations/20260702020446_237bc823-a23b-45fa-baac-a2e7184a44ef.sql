
-- 1) Chat message metadata
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS reaction text CHECK (reaction IN ('like','dislike','none')) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS credits_used integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS execution_time_ms integer DEFAULT 0;

-- 2) Async task queue
CREATE TABLE IF NOT EXISTS public.ai_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
  project_id uuid,
  kind text NOT NULL,               -- e.g. 'chat', 'web_search', 'code_gen', 'build'
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled')),
  step text,                        -- current human-readable step
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error text,
  credits_used integer DEFAULT 0,
  execution_time_ms integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.ai_tasks TO authenticated;
GRANT ALL ON public.ai_tasks TO service_role;

ALTER TABLE public.ai_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_tasks_select" ON public.ai_tasks;
CREATE POLICY "own_tasks_select" ON public.ai_tasks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "own_tasks_insert" ON public.ai_tasks;
CREATE POLICY "own_tasks_insert" ON public.ai_tasks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own_tasks_update" ON public.ai_tasks;
CREATE POLICY "own_tasks_update" ON public.ai_tasks
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.get_my_role() = 'admin')
  WITH CHECK (user_id = auth.uid() OR public.get_my_role() = 'admin');

CREATE INDEX IF NOT EXISTS idx_ai_tasks_user ON public.ai_tasks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON public.ai_tasks(status);

-- touch updated_at
DROP TRIGGER IF EXISTS trg_ai_tasks_touch ON public.ai_tasks;
CREATE TRIGGER trg_ai_tasks_touch BEFORE UPDATE ON public.ai_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- realtime
ALTER TABLE public.ai_tasks REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='ai_tasks';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_tasks';
  END IF;
END $$;

-- 3) Admin permanent delete on user_projects
DROP POLICY IF EXISTS "admin_delete_projects" ON public.user_projects;
CREATE POLICY "admin_delete_projects" ON public.user_projects
  FOR DELETE TO authenticated
  USING (public.get_my_role() = 'admin');

-- 4) Bulk admin delete RPC with audit
CREATE OR REPLACE FUNCTION public.admin_permanent_delete_projects(project_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
  pid uuid;
  proj record;
BEGIN
  IF public.get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'admin_only';
  END IF;
  IF project_ids IS NULL OR array_length(project_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  FOREACH pid IN ARRAY project_ids LOOP
    SELECT id, user_id, name, type INTO proj FROM public.user_projects WHERE id = pid;
    IF FOUND THEN
      DELETE FROM public.user_projects WHERE id = pid;
      deleted_count := deleted_count + 1;
      INSERT INTO public.admin_audit_log (actor_id, event_type, target_table, target_id, before, note)
      VALUES (auth.uid(), 'project.permanent_delete', 'user_projects', pid::text,
              jsonb_build_object('user_id', proj.user_id, 'name', proj.name, 'type', proj.type),
              'permanent delete from admin monitor');
    END IF;
  END LOOP;

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_permanent_delete_projects(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_permanent_delete_projects(uuid[]) TO authenticated;
