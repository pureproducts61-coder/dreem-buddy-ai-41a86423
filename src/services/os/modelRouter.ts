/**
 * Device-aware Model Router.
 * Preference order:
 *   1. suitable local model on THIS device
 *   2. suitable local model on a connected, trusted computer
 *   3. an Ollama model on that computer
 *   4. any other reported local runtime on the account
 *   5. cloud — only when no local runtime can serve the task
 * A model is only ever reported as "used" when a runtime confirmed it.
 */
import { selectModelFor, modelRequirements, type ModelTask } from './orchestrator';
import { modelRegistry } from './modelManager';
import { deviceId, getDevices } from './deviceRegistry';
import { getOllamaState } from './ollama';

export type ModelPlace = 'this-device' | 'remote-device' | 'ollama' | 'cloud';

export interface ModelRoute {
  place: ModelPlace;
  modelName: string | null;
  deviceId: string | null;
  deviceName: string | null;
  reason: string;
  /** false until a runtime actually answered with this model */
  confirmed: boolean;
}

function taskMatchesName(name: string, task: ModelTask): boolean {
  const fake = { id: 'x', name, family: '', version: '', params: '', quant: '', url: '', sizeBytes: 0, bytesDownloaded: 0, status: 'ready', enabled: true, isDefault: false, source: 'detected', addedAt: '' } as never;
  return modelRequirements(fake).capabilities.includes(task);
}

export async function routeModel(task: ModelTask, opts: { online?: boolean } = {}): Promise<ModelRoute> {
  const online = opts.online ?? (typeof navigator === 'undefined' ? true : navigator.onLine);

  // 1. this device
  const local = await selectModelFor(task);
  if (local.model) {
    return {
      place: 'this-device', modelName: local.model.name, deviceId: deviceId(), deviceName: 'this device',
      reason: local.reason, confirmed: false,
    };
  }

  const me = deviceId();
  const remotes = getDevices().filter(
    (d) => d.online && d.device_id !== me && (d as { revoked?: boolean }).revoked !== true,
  );

  // 2. local model on a connected computer
  for (const d of remotes) {
    const m = (d.models || []).find((x) => x.status === 'ready' && taskMatchesName(x.name, task));
    if (m) {
      return {
        place: 'remote-device', modelName: m.name, deviceId: d.device_id, deviceName: d.name,
        reason: `${m.name} on ${d.name} can handle ${task}.`, confirmed: false,
      };
    }
  }

  // 3. Ollama on this computer / a connected computer
  const oll = getOllamaState();
  if (oll.running) {
    const m = oll.models.find((x) => taskMatchesName(x.name, task)) || oll.models[0];
    if (m) {
      return {
        place: 'ollama', modelName: m.name, deviceId: me, deviceName: 'this computer',
        reason: `Ollama model ${m.name} is available locally.`, confirmed: false,
      };
    }
  }
  for (const d of remotes) {
    const runtimes = (d as { runtimes?: { ollama?: { running?: boolean; models?: { name: string }[] } } }).runtimes;
    const list = runtimes?.ollama?.running ? runtimes.ollama.models || [] : [];
    const m = list.find((x) => taskMatchesName(x.name, task)) || list[0];
    if (m) {
      return {
        place: 'ollama', modelName: m.name, deviceId: d.device_id, deviceName: d.name,
        reason: `Ollama model ${m.name} on ${d.name}.`, confirmed: false,
      };
    }
  }

  // 4/5. cloud only when something is actually reachable
  const registered = modelRegistry.getAll().find((m) => modelRequirements(m).capabilities.includes(task));
  return {
    place: 'cloud', modelName: null, deviceId: null, deviceName: null,
    confirmed: false,
    reason: online
      ? registered
        ? `No local model is ready for ${task} (${registered.name} is registered but not downloaded), so I will use the cloud.`
        : `No local model can do ${task} yet, so I will use the cloud.`
      : `No local model can do ${task} and there is no internet, so I cannot run this right now.`,
  };
}

/** Called by a runtime after it really produced output with a model. */
export function confirmModelUse(route: ModelRoute, modelName?: string): ModelRoute {
  return { ...route, confirmed: true, modelName: modelName || route.modelName };
}

export async function modelRoutingPromptBlock(task: ModelTask = 'chat'): Promise<string> {
  const r = await routeModel(task);
  return `Model routing for ${task}: ${r.place}${r.modelName ? ` (${r.modelName})` : ''} — ${r.reason}`;
}
