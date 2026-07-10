
-- ============ ai_system_settings ============
CREATE TABLE IF NOT EXISTS public.ai_system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_system_settings TO authenticated;
GRANT ALL ON public.ai_system_settings TO service_role;

ALTER TABLE public.ai_system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage system settings" ON public.ai_system_settings;
CREATE POLICY "Admins manage system settings"
ON public.ai_system_settings FOR ALL
TO authenticated
USING (public.get_my_role() = 'admin')
WITH CHECK (public.get_my_role() = 'admin');

INSERT INTO public.ai_system_settings (key, value)
VALUES ('execution_mode', '{"mode":"AUTOMATION_PRO","active_agents":6}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============ agent_tasks_queue ============
CREATE TABLE IF NOT EXISTS public.agent_tasks_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  task_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_tasks_queue TO authenticated;
GRANT ALL ON public.agent_tasks_queue TO service_role;

ALTER TABLE public.agent_tasks_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own tasks" ON public.agent_tasks_queue;
CREATE POLICY "Users read own tasks"
ON public.agent_tasks_queue FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "Users insert own tasks" ON public.agent_tasks_queue;
CREATE POLICY "Users insert own tasks"
ON public.agent_tasks_queue FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own tasks" ON public.agent_tasks_queue;
CREATE POLICY "Users update own tasks"
ON public.agent_tasks_queue FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR public.get_my_role() = 'admin')
WITH CHECK (user_id = auth.uid() OR public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "Users delete own tasks" ON public.agent_tasks_queue;
CREATE POLICY "Users delete own tasks"
ON public.agent_tasks_queue FOR DELETE
TO authenticated
USING (user_id = auth.uid() OR public.get_my_role() = 'admin');

-- ============ agent_execution_logs ============
CREATE TABLE IF NOT EXISTS public.agent_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  step_name text NOT NULL,
  status text NOT NULL,
  message text,
  progress integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid
);

ALTER TABLE public.agent_execution_logs
  ADD COLUMN IF NOT EXISTS user_id uuid;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_execution_logs TO authenticated;
GRANT ALL ON public.agent_execution_logs TO service_role;

ALTER TABLE public.agent_execution_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read logs" ON public.agent_execution_logs;
DROP POLICY IF EXISTS "Allow system to insert logs" ON public.agent_execution_logs;
DROP POLICY IF EXISTS "Users read own agent logs" ON public.agent_execution_logs;
DROP POLICY IF EXISTS "Users insert own agent logs" ON public.agent_execution_logs;

CREATE POLICY "Users read own agent logs"
ON public.agent_execution_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.get_my_role() = 'admin');

CREATE POLICY "Users insert own agent logs"
ON public.agent_execution_logs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
