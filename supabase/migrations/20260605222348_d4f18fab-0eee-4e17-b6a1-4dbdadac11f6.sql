CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.ai_memory_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic text NOT NULL,
  content text NOT NULL,
  summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(768),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_memory_entries TO authenticated;
GRANT ALL ON public.ai_memory_entries TO service_role;
ALTER TABLE public.ai_memory_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own AI memories" ON public.ai_memory_entries;
CREATE POLICY "Users manage own AI memories"
ON public.ai_memory_entries
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS ai_memory_entries_user_created_idx
ON public.ai_memory_entries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_memory_entries_embedding_idx
ON public.ai_memory_entries
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE TRIGGER touch_ai_memory_entries_updated_at
BEFORE UPDATE ON public.ai_memory_entries
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.search_ai_memory(query_embedding vector(768), match_count integer DEFAULT 6)
RETURNS TABLE(id uuid, topic text, content text, summary text, metadata jsonb, similarity double precision, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT m.id,
         m.topic,
         m.content,
         m.summary,
         m.metadata,
         (1 - (m.embedding <=> query_embedding))::double precision AS similarity,
         m.created_at
  FROM public.ai_memory_entries m
  WHERE m.user_id = auth.uid()
    AND m.embedding IS NOT NULL
  ORDER BY m.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 20);
$$;
REVOKE EXECUTE ON FUNCTION public.search_ai_memory(vector, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_ai_memory(vector, integer) TO authenticated;
COMMENT ON FUNCTION public.search_ai_memory(vector, integer) IS 'SECURITY DEFINER intentionally used for user-scoped vector memory search; it only returns rows owned by auth.uid().';

CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  source text NOT NULL DEFAULT 'login',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.emergency_contacts TO authenticated;
GRANT ALL ON public.emergency_contacts TO service_role;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage emergency contacts" ON public.emergency_contacts;
CREATE POLICY "Admins manage emergency contacts"
ON public.emergency_contacts
FOR ALL
TO authenticated
USING (public.get_my_role() = 'admin')
WITH CHECK (public.get_my_role() = 'admin');

CREATE INDEX IF NOT EXISTS emergency_contacts_created_idx
ON public.emergency_contacts (created_at DESC);

CREATE TRIGGER touch_emergency_contacts_updated_at
BEFORE UPDATE ON public.emergency_contacts
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();