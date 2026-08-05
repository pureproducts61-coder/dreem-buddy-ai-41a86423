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
  version?: string;
  author?: string;
  permissions?: string[];
  capabilities?: string[];
  dependencies?: string[];
  requiredModels?: string[];
  requiredBridgePermissions?: string[];
  status?: 'installed' | 'disabled' | 'error';
}

export const pluginRegistry = new LocalRegistry<OsPlugin>('tivo-os-plugins', []);

export function addPlugin(input: Omit<OsPlugin, 'id' | 'addedAt'>) {
  return pluginRegistry.add({
    version: '1.0.0', author: '', permissions: [], capabilities: [],
    dependencies: [], requiredModels: [], requiredBridgePermissions: [],
    status: 'installed',
    ...input,
    addedAt: new Date().toISOString(),
  } as Omit<OsPlugin, 'id'>);
}

/** Install a plugin from a manifest JSON string (no core changes needed). */
export function installFromManifest(json: string) {
  const m = JSON.parse(json) as Record<string, unknown>;
  if (!m.name) throw new Error('Manifest is missing "name"');
  return addPlugin({
    name: String(m.name),
    description: String(m.description || ''),
    kind: (m.kind as OsPlugin['kind']) || 'tool',
    entry: String(m.entry || ''),
    enabled: true,
    requiresBridge: Array.isArray(m.requiredBridgePermissions) && m.requiredBridgePermissions.length > 0,
    config: (m.config as Record<string, unknown>) || {},
    version: String(m.version || '1.0.0'),
    author: String(m.author || ''),
    permissions: (m.permissions as string[]) || [],
    capabilities: (m.capabilities as string[]) || [],
    dependencies: (m.dependencies as string[]) || [],
    requiredModels: (m.requiredModels as string[]) || [],
    requiredBridgePermissions: (m.requiredBridgePermissions as string[]) || [],
    status: 'installed',
  });
}

export function enabledPlugins() {
  return pluginRegistry.getAll().filter((p) => p.enabled);
}

export function pluginsPromptBlock(): string {
  const list = enabledPlugins();
  if (!list.length) return '';
  return list.map((p) => {
    const needs = (p.requiredBridgePermissions || []).join(', ');
    return `- ${p.name} v${p.version || '1.0.0'} (${p.kind}): ${p.description}${needs ? ` [requires: ${needs}]` : ''}`;
  }).join('\n');
}