-- Additive, nullable columns only: truthful GitHub Actions verification data.
ALTER TABLE public.build_reports
  ADD COLUMN IF NOT EXISTS delivery text,
  ADD COLUMN IF NOT EXISTS verification text,
  ADD COLUMN IF NOT EXISTS run_id bigint,
  ADD COLUMN IF NOT EXISTS run_status text,
  ADD COLUMN IF NOT EXISTS run_conclusion text,
  ADD COLUMN IF NOT EXISTS commit_sha text,
  ADD COLUMN IF NOT EXISTS workflow_file text,
  ADD COLUMN IF NOT EXISTS artifacts jsonb;