CREATE TABLE public.world_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ref_key text NOT NULL,
  type text NOT NULL,
  locator text NOT NULL,
  source text NOT NULL,
  scope text NOT NULL DEFAULT 'user',
  status text NOT NULL DEFAULT 'unknown',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ref_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_resources TO authenticated;
GRANT ALL ON public.world_resources TO service_role;
ALTER TABLE public.world_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own world_resources" ON public.world_resources FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.world_affordances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  resource_id uuid NOT NULL REFERENCES public.world_resources(id) ON DELETE CASCADE,
  action text NOT NULL,
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  preconditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_effect text NOT NULL,
  constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk text NOT NULL CHECK (risk IN ('none','low','medium','high','critical')),
  authority_required text NOT NULL,
  reversibility text NOT NULL CHECK (reversibility IN ('reversible','partially','irreversible','unknown')),
  verification_hint text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, action)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_affordances TO authenticated;
GRANT ALL ON public.world_affordances TO service_role;
ALTER TABLE public.world_affordances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own world_affordances" ON public.world_affordances FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.interaction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id text,
  resource_id uuid NOT NULL REFERENCES public.world_resources(id) ON DELETE CASCADE,
  affordance_id uuid NOT NULL REFERENCES public.world_affordances(id) ON DELETE CASCADE,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  authority_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_effect text NOT NULL,
  verification_hint text,
  control_decision jsonb NOT NULL,
  idempotency_key text NOT NULL,
  correlation_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('accepted','pending_approval','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
GRANT SELECT, INSERT ON public.interaction_requests TO authenticated;
GRANT ALL ON public.interaction_requests TO service_role;
ALTER TABLE public.interaction_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own interaction_requests" ON public.interaction_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert own interaction_requests" ON public.interaction_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);