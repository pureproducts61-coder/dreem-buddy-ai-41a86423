import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'dreem-settings';

const db = supabase as unknown as { from: (t: string) => any };

export type SystemSettingsMap = Record<string, string | number | boolean>;

const SYSTEM_SETTING_KEYS = [
  'aiModel',
  'geminiApiKey',
  'groqApiKey',
  'deepseekApiKey',
  'tavilyApiKey',
  'hfToken',
  'vercelToken',
  'backendUrl',
  'masterSecret',
  'autoSave',
  'syncEnabled',
  'defaultUserCredits',
] as const;

const SECRET_KEYS = new Set([
  'geminiApiKey', 'groqApiKey', 'deepseekApiKey', 'tavilyApiKey',
  'hfToken', 'vercelToken', 'masterSecret', 'backendUrl',
]);

function parseValue(value: string): string | number | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}

function toStoredValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function loadLocalSystemSettings(): Partial<SystemSettingsMap> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const base = stored ? JSON.parse(stored) : {};
    return {
      ...base,
      backendUrl: localStorage.getItem('tivo-hf-url') || base.backendUrl || '',
      masterSecret: localStorage.getItem('tivo-master-secret') || base.masterSecret || '',
      defaultUserCredits: Number(localStorage.getItem('tivo-default-credits') || base.defaultUserCredits || 50),
    };
  } catch {
    return {};
  }
}

export async function loadSystemSettingsFromDb(): Promise<Partial<SystemSettingsMap>> {
  const { data, error } = await db.from('system_settings').select('key,value');
  if (error || !data) return {};
  return Object.fromEntries(
    (data as Array<{ key: string; value: string }>).map((row) => [row.key, parseValue(row.value)]),
  );
}

export async function loadMergedSystemSettings<T extends SystemSettingsMap>(defaults: T): Promise<T> {
  const local = loadLocalSystemSettings();
  const remote = await loadSystemSettingsFromDb();
  return { ...defaults, ...local, ...remote } as T;
}

export function saveLocalSystemSettings(settings: SystemSettingsMap) {
  localStorage.setItem('tivo-hf-url', toStoredValue(settings.backendUrl));
  localStorage.setItem('tivo-master-secret', toStoredValue(settings.masterSecret));
  localStorage.setItem('tivo-default-credits', toStoredValue(settings.defaultUserCredits));
  const { backendUrl, masterSecret, defaultUserCredits, ...rest } = settings;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
}

export async function saveSystemSettingsToDb(settings: SystemSettingsMap) {
  const { data: { user } } = await supabase.auth.getUser();
  const rows = SYSTEM_SETTING_KEYS.map((key) => ({
    key,
    value: toStoredValue(settings[key]),
    is_secret: SECRET_KEYS.has(key),
    description: key,
    updated_by: user?.id || null,
  }));
  const { error } = await db.from('system_settings').upsert(rows, { onConflict: 'key' });
  if (error) throw error;
}