import { useSyncExternalStore } from 'react';

interface AgentState {
  currentStep: number;
  steps: string[];
  status: 'idle' | 'thinking' | 'working' | 'completed' | 'error';
  agentName: string;
  setAgentStatus: (name: string, status: any, step?: number) => void;
  resetAgent: () => void;
}

type AgentStatus = AgentState['status'];

const listeners = new Set<() => void>();

let state: AgentState = {
  currentStep: 0,
  steps: ['Architect', 'Planner', 'Researcher', 'Coder', 'Tester', 'Reviewer'],
  status: 'idle',
  agentName: '',
  setAgentStatus: (name: string, status: AgentStatus, step?: number) => {
    state = {
      ...state,
      agentName: name,
      status,
      currentStep: step !== undefined ? step : state.currentStep,
    };
    listeners.forEach((listener) => listener());
  },
  resetAgent: () => {
    state = { ...state, currentStep: 0, status: 'idle', agentName: '' };
    listeners.forEach((listener) => listener());
  },
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => state;

export const useAgentStore = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);