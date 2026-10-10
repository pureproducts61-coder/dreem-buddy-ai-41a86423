CREATE TABLE public.interaction_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_id uuid NOT NULL UNIQUE REFERENCES public.interaction_requests(id) ON DELETE CASCADE,
  runtime_id text,
  status text NOT NULL CHECK (status IN ('started','running','completed','failed','timed_out','cancelled','unknown','refused','runtime_unavailable')),
  observations jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  duration_ms integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT ON public.interaction_executions TO authenticated;
GRANT ALL ON public.interaction_executions TO service_role;
ALTER TABLE public.interaction_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own interaction_executions" ON public.interaction_executions FOR SELECT TO authenticated USING (auth.uid() = user_id);