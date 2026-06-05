CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.search_ai_memory(query_embedding vector(768), match_count integer DEFAULT 6)
RETURNS TABLE(id uuid, topic text, content text, summary text, metadata jsonb, similarity double precision, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'extensions'
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
COMMENT ON FUNCTION public.search_ai_memory(vector, integer) IS 'SECURITY INVOKER user-scoped vector memory search. RLS plus auth.uid() restricts results to the caller’s own memory rows.';