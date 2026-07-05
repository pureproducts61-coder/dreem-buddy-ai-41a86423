-- TIVO System Settings & Task Management
CREATE TABLE IF NOT EXISTS ai_system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_tasks_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  payload JSONB,
  result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default Settings
INSERT INTO ai_system_settings (key, value)
VALUES ('execution_mode', '{"mode": "AUTOMATION_PRO", "active_agents": 6}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;