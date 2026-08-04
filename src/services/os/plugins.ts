/**
 * Plugin / skill registry — lets new abilities be added without code changes.
 */
import { LocalRegistry } from './registry';

export interface OsPlugin {
  id: string;
  [key: string]: unknown;
  name: string;
  description: string;
  kind: 'tool' | 'skill' | 'connector' | 'automation';
  entry: string;            // URL, bridge action name or prompt template id
  enabled: boolean;
  requiresBridge: boolean;
  config: Record<string, unknown>;
  addedAt: string;
}

export const pluginRegistry = new LocalRegistry<OsPlugin>('tivo-os-plugins', []);

export function addPlugin(input: Omit<OsPlugin, 'id' | 'addedAt'>) {
  return pluginRegistry.add({ ...input, addedAt: new Date().toISOString() } as Omit<OsPlugin, 'id'>);
}

export function enabledPlugins() {
  return pluginRegistry.getAll().filter((p) => p.enabled);
}

export function pluginsPromptBlock(): string {
  const list = enabledPlugins();
  if (!list.length) return '';
  return list.map((p) => `- ${p.name} (${p.kind}): ${p.description}`).join('\n');
}