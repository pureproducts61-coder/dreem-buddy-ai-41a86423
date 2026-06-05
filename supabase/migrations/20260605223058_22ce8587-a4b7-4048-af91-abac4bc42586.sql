DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_contacts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;