import { create } from 'zustand';

interface AgentState {
  currentStep: string;
  progress: number;
  status: 'idle' | 'thinking' | 'searching' | 'coding' | 'testing' | 'reviewing' | 'completed' | 'failed';
  agents: {
    planner: { status: string; progress: number };
    researcher: { status: string; progress: number };
    coder: { status: string; progress: number };
    github: { status: string; progress: number };
    tester: { status: string; progress: number };
    reviewer: { status: string; progress: number };
  };
  updateAgent: (agent: string, status: string, progress: number) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  currentStep: 'Waiting for task...',
  progress: 0,
  status: 'idle',
  agents: {
    planner: { status: 'idle', progress: 0 },
    researcher: { status: 'idle', progress: 0 },
    coder: { status: 'idle', progress: 0 },
    github: { status: 'idle', progress: 0 },
    tester: { status: 'idle', progress: 0 },
    reviewer: { status: 'idle', progress: 0 },
  },
  updateAgent: (agent, status, progress) => set((state) => ({
    agents: {
      ...state.agents,
      [agent]: { status, progress }
    },
    status: status as any,
    progress: progress
  })),
  reset: () => set({
    status: 'idle',
    progress: 0,
    agents: {
      planner: { status: 'idle', progress: 0 },
      researcher: { status: 'idle', progress: 0 },
      coder: { status: 'idle', progress: 0 },
      github: { status: 'idle', progress: 0 },
      tester: { status: 'idle', progress: 0 },
      reviewer: { status: 'idle', progress: 0 },
    }
  })
}));