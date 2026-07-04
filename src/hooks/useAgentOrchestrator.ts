import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AgentStatus = 'idle' | 'planning' | 'researching' | 'coding' | 'building' | 'testing' | 'reviewing' | 'success' | 'failed';

export interface AgentTask {
  id: string;
  step: string;
  status: AgentStatus;
  message: string;
  progress: number;
  timestamp: string;
}

export const useAgentOrchestrator = (sessionId?: string) => {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [currentStatus, setCurrentStatus] = useState<AgentStatus>('idle');

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`agent-tasks-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_execution_logs',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const newTask = payload.new as any;
          setTasks((prev) => [...prev, {
            id: newTask.id,
            step: newTask.step_name,
            status: newTask.status,
            message: newTask.message,
            progress: newTask.progress,
            timestamp: newTask.created_at
          }]);
          setCurrentStatus(newTask.status);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const logStep = async (step: string, status: AgentStatus, message: string, progress: number) => {
    if (!sessionId) return;
    
    const { error } = await supabase
      .from('agent_execution_logs')
      .insert({
        session_id: sessionId,
        step_name: step,
        status: status,
        message: message,
        progress: progress
      });

    if (error) console.error('Error logging agent step:', error);
  };

  return { tasks, currentStatus, logStep };
};
