import React from 'react';
import { useAgentStore } from '../../store/useAgentStore';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';

export const AgentProgress = () => {
  const { currentStep, steps, status, agentName } = useAgentStore();

  if (status === 'idle') return null;

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="w-full p-4 space-y-2 bg-background/80 backdrop-blur-sm border-b sticky top-0 z-50">
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <Badge variant={status === 'error' ? 'destructive' : 'default'} className="animate-pulse">
            {agentName || steps[currentStep]} Agent
          </Badge>
          <span className="text-sm font-medium text-muted-foreground">{status}...</span>
        </div>
        <span className="text-xs text-muted-foreground">{currentStep + 1} of {steps.length} Steps</span>
      </div>
      <Progress value={status === 'completed' ? 100 : progress} className="h-1.5" />
      <div className="flex justify-between mt-1">
        {steps.map((step, idx) => (
          <div key={step} className={`text-[10px] ${idx <= currentStep ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
            {step}
          </div>
        ))}
      </div>
    </div>
  );
};