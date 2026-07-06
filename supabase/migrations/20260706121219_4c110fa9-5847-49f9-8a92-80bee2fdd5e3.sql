
CREATE TABLE public.build_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id text,
  project_name text NOT NULL,
  build_target text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  run_url text,
  repo_url text,
  error text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.build_reports TO authenticated;
GRANT ALL ON public.build_reports TO service_role;

ALTER TABLE public.build_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own build reports"
  ON public.build_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.get_my_role() = 'admin');

CREATE POLICY "Users insert own build reports"
  ON public.build_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own build reports"
  ON public.build_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.get_my_role() = 'admin')
  WITH CHECK (auth.uid() = user_id OR public.get_my_role() = 'admin');

CREATE POLICY "Admin delete build reports"
  ON public.build_reports FOR DELETE
  TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE TRIGGER trg_build_reports_touch
  BEFORE UPDATE ON public.build_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX build_reports_user_created_idx ON public.build_reports (user_id, created_at DESC);
CREATE INDEX build_reports_status_idx ON public.build_reports (status);

ALTER PUBLICATION supabase_realtime ADD TABLE public.build_reports;
