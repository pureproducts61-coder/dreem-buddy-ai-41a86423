import React from 'react';
import { useAgentStore } from '../../store/useAgentStore';

export const AgentProgress = () => {
  const { agents } = useAgentStore();

  return (
    <div className="p-4 bg-black/20 backdrop-blur-md rounded-lg border border-white/10 space-y-3">
      {Object.entries(agents).map(([name, data]) => (
        <div key={name} className="flex flex-col gap-1">
          <div className="flex justify-between text-xs font-semibold capitalize">
            <span>{name} Agent</span>
            <span className="text-primary">{data.status}</span>
          </div>
          <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500" 
              style={{ width: `${data.progress}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};