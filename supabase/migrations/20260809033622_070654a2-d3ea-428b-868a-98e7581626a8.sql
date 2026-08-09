
ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS trusted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revoked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trusted_at timestamptz,
  ADD COLUMN IF NOT EXISTS bridge_version text,
  ADD COLUMN IF NOT EXISTS hardware jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS runtimes jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.device_commands
  ADD COLUMN IF NOT EXISTS tool text,
  ADD COLUMN IF NOT EXISTS destructive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification jsonb,
  ADD COLUMN IF NOT EXISTS authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS device_commands_idem_uidx
  ON public.device_commands (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS device_commands_target_status_idx
  ON public.device_commands (target_device_id, status, created_at);

CREATE INDEX IF NOT EXISTS user_devices_user_online_idx
  ON public.user_devices (user_id, online, last_heartbeat);

CREATE TABLE IF NOT EXISTS public.command_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id uuid NOT NULL REFERENCES public.device_commands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  target_device_id text NOT NULL,
  tool text,
  capability text NOT NULL,
  action text NOT NULL,
  permission_result text NOT NULL,
  status text NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  verification jsonb,
  failure_reason text,
  result_summary text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.command_executions TO authenticated;
GRANT ALL ON public.command_executions TO service_role;
ALTER TABLE public.command_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own command executions read" ON public.command_executions;
CREATE POLICY "own command executions read" ON public.command_executions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own command executions insert" ON public.command_executions;
CREATE POLICY "own command executions insert" ON public.command_executions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS command_executions_cmd_idx ON public.command_executions (command_id, created_at);
