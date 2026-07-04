-- Migration: Initialize Agent Execution Logs
-- Created at: 2026-07-04
-- Purpose: Track multi-agent progress in real-time

CREATE TABLE IF NOT EXISTS public.agent_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    progress INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE agent_execution_logs;

-- RLS Policies
ALTER TABLE public.agent_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read logs"
ON public.agent_execution_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow system to insert logs"
ON public.agent_execution_logs FOR INSERT
TO authenticated
WITH CHECK (true);
