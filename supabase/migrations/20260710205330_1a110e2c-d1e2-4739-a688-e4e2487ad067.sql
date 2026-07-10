
-- AI Provider configuration table for dynamic provider/model selection
CREATE TABLE IF NOT EXISTS public.ai_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  display_name TEXT,
  api_key_secret_name TEXT,
  base_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_free BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 100,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  task_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_tokens INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, model)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_provider_configs TO authenticated;
GRANT ALL ON public.ai_provider_configs TO service_role;

ALTER TABLE public.ai_provider_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_provider_configs" ON public.ai_provider_configs
  FOR ALL TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "authenticated_read_enabled_providers" ON public.ai_provider_configs
  FOR SELECT TO authenticated
  USING (enabled = true);

CREATE TRIGGER touch_ai_provider_configs
  BEFORE UPDATE ON public.ai_provider_configs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Task -> provider routing preferences (admin-configurable)
CREATE TABLE IF NOT EXISTS public.ai_task_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL UNIQUE, -- code, chat, research, vision, quick, deep_reasoning, embedding
  preferred_config_id UUID REFERENCES public.ai_provider_configs(id) ON DELETE SET NULL,
  fallback_config_ids UUID[] DEFAULT '{}',
  auto_route BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_task_routing TO authenticated;
GRANT ALL ON public.ai_task_routing TO service_role;
ALTER TABLE public.ai_task_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_task_routing" ON public.ai_task_routing
  FOR ALL TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "authenticated_read_task_routing" ON public.ai_task_routing
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER touch_ai_task_routing
  BEFORE UPDATE ON public.ai_task_routing
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed common free/available providers (admin can edit/toggle after)
INSERT INTO public.ai_provider_configs (provider, model, display_name, api_key_secret_name, base_url, is_free, priority, capabilities, task_types, enabled) VALUES
  ('lovable', 'google/gemini-2.5-flash', 'Lovable Gemini 2.5 Flash', 'LOVABLE_API_KEY', 'https://ai.gateway.lovable.dev/v1', true, 10, '["chat","code","vision"]'::jsonb, '["chat","code","quick"]'::jsonb, false),
  ('lovable', 'google/gemini-2.5-pro', 'Lovable Gemini 2.5 Pro', 'LOVABLE_API_KEY', 'https://ai.gateway.lovable.dev/v1', false, 20, '["chat","code","vision","reasoning"]'::jsonb, '["code","deep_reasoning","research"]'::jsonb, false),
  ('gemini', 'gemini-2.0-flash-exp', 'Google Gemini 2.0 Flash (Direct)', 'GEMINI_API_KEY', 'https://generativelanguage.googleapis.com/v1beta', true, 15, '["chat","code","vision"]'::jsonb, '["chat","code","quick"]'::jsonb, true),
  ('groq', 'llama-3.3-70b-versatile', 'Groq Llama 3.3 70B', 'GROQ_API_KEY', 'https://api.groq.com/openai/v1', true, 25, '["chat","code"]'::jsonb, '["chat","code","quick"]'::jsonb, false),
  ('deepseek', 'deepseek-chat', 'DeepSeek Chat', 'DEEPSEEK_API_KEY', 'https://api.deepseek.com/v1', false, 30, '["chat","code","reasoning"]'::jsonb, '["code","deep_reasoning"]'::jsonb, false),
  ('openrouter', 'meta-llama/llama-3.3-70b-instruct:free', 'OpenRouter Llama 3.3 Free', 'OPENROUTER_API_KEY', 'https://openrouter.ai/api/v1', true, 35, '["chat","code"]'::jsonb, '["chat","code","quick"]'::jsonb, false),
  ('hf', 'meta-llama/Meta-Llama-3-8B-Instruct', 'HuggingFace Llama 3 8B', 'HF_TOKEN', 'https://api-inference.huggingface.co/models', true, 40, '["chat"]'::jsonb, '["chat","quick"]'::jsonb, false)
ON CONFLICT (provider, model) DO NOTHING;

-- Seed default routing preferences (task -> null = auto-pick highest priority enabled)
INSERT INTO public.ai_task_routing (task_type, auto_route) VALUES
  ('chat', true), ('code', true), ('research', true),
  ('vision', true), ('quick', true), ('deep_reasoning', true), ('embedding', true)
ON CONFLICT (task_type) DO NOTHING;
