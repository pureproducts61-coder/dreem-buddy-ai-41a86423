import { create } from 'zustand';

interface AgentState {
  currentStep: number;
  steps: string[];
  status: 'idle' | 'thinking' | 'working' | 'completed' | 'error';
  agentName: string;
  setAgentStatus: (name: string, status: any, step?: number) => void;
  resetAgent: () => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  currentStep: 0,
  steps: ['Architect', 'Planner', 'Researcher', 'Coder', 'Tester', 'Reviewer'],
  status: 'idle',
  agentName: '',
  setAgentStatus: (name, status, step) => set((state) => ({ 
    agentName: name, 
    status, 
    currentStep: step !== undefined ? step : state.currentStep 
  })),
  resetAgent: () => set({ currentStep: 0, status: 'idle', agentName: '' }),
}));