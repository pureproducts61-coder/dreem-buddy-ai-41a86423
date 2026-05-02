import { useEffect, useState } from 'react';
import { subscribeDeployJobs, type DeployJob } from '@/services/deployQueueService';

export function useDeployJobs(sessionId?: string): DeployJob[] {
  const [jobs, setJobs] = useState<DeployJob[]>([]);
  useEffect(() => {
    return subscribeDeployJobs(all => {
      setJobs(sessionId ? all.filter(j => j.sessionId === sessionId) : all);
    });
  }, [sessionId]);
  return jobs;
}
