DO $$
BEGIN
  BEGIN
    EXECUTE 'SET LOCAL ROLE supabase_realtime_admin';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'no role switch';
  END;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages'
      AND policyname = 'realtime_user_scoped_topics'
  ) THEN
    EXECUTE $p$
      CREATE POLICY realtime_user_scoped_topics
      ON realtime.messages
      FOR SELECT
      TO authenticated
      USING (
        auth.uid() IS NOT NULL
        AND (
          realtime.topic() = 'user:' || auth.uid()::text
          OR realtime.topic() LIKE 'user:' || auth.uid()::text || ':%'
        )
      )
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'realtime' AND tablename = 'messages'
      AND policyname = 'realtime_user_scoped_broadcast_write'
  ) THEN
    EXECUTE $p$
      CREATE POLICY realtime_user_scoped_broadcast_write
      ON realtime.messages
      FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND (
          realtime.topic() = 'user:' || auth.uid()::text
          OR realtime.topic() LIKE 'user:' || auth.uid()::text || ':%'
        )
      )
    $p$;
  END IF;
END $$;