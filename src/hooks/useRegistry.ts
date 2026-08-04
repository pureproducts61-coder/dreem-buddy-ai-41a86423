import { useSyncExternalStore } from 'react';
import type { LocalRegistry, RegistryRecord } from '@/services/os/registry';

export function useRegistry<T extends RegistryRecord>(registry: LocalRegistry<T>): T[] {
  return useSyncExternalStore(registry.subscribe, registry.getAll, registry.getAll);
}