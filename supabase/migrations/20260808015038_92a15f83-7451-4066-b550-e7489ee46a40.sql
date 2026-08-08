
CREATE TABLE IF NOT EXISTS public.user_devices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  name text NOT NULL,
  platform text,
  role text NOT NULL DEFAULT 'mobile',
  online boolean NOT NULL DEFAULT true,
  health text NOT NULL DEFAULT 'good',
  bridge_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  models jsonb NOT NULL DEFAULT '[]'::jsonb,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_devices TO authenticated;
GRANT ALL ON public.user_devices TO service_role;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_devices" ON public.user_devices
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_user_devices_touch BEFORE UPDATE ON public.user_devices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.device_commands (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_device_id text NOT NULL,
  source_device_id text,
  capability text NOT NULL,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  progress text,
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_commands TO authenticated;
GRANT ALL ON public.device_commands TO service_role;
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_commands" ON public.device_commands
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_device_commands_touch BEFORE UPDATE ON public.device_commands
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_device_commands_target ON public.device_commands (user_id, target_device_id, status);
CREATE INDEX IF NOT EXISTS idx_user_devices_user ON public.user_devices (user_id, online);
