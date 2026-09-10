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
  'githubToken',
  'backendUrl',
  'masterSecret',
  'autoSave',
  'syncEnabled',
  'defaultUserCredits',
] as const;

const SECRET_KEYS = new Set([
  'geminiApiKey', 'groqApiKey', 'deepseekApiKey', 'tavilyApiKey',
  'hfToken', 'vercelToken', 'githubToken', 'masterSecret', 'backendUrl',
]);

/**
 * Credentials must never be persisted in the browser: localStorage is readable
 * by any script on the page, so a single XSS would leak every provider key.
 * They live only in the admin-only `system_settings` table (and the per-user
 * `user_secrets` vault) and are fetched on demand.
 */
const CREDENTIAL_KEYS = new Set([
  'geminiApiKey', 'groqApiKey', 'deepseekApiKey', 'tavilyApiKey',
  'hfToken', 'vercelToken', 'githubToken', 'masterSecret',
]);

const isCredentialKey = (key: string) =>
  CREDENTIAL_KEYS.has(key) || /(apikey|token|secret|password)$/i.test(key);

function stripCredentials<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (!isCredentialKey(k)) out[k] = v;
  return out as Partial<T>;
}

/** Removes credentials that older builds wrote into the browser. */
function purgeLegacyBrowserSecrets() {
  try {
    localStorage.removeItem('tivo-master-secret');
    localStorage.removeItem('tivo-github-token');
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    const cleaned = stripCredentials(parsed);
    if (Object.keys(cleaned).length !== Object.keys(parsed).length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
  } catch { /* ignore */ }
}

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
  purgeLegacyBrowserSecrets();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const base = stripCredentials(stored ? JSON.parse(stored) : {}) as Partial<SystemSettingsMap>;
    return {
      ...base,
      backendUrl: localStorage.getItem('tivo-hf-url') || (base.backendUrl as string) || '',
      defaultUserCredits: Number(localStorage.getItem('tivo-default-credits') || base.defaultUserCredits || 50),
    };
  } catch {
    return {};
  }
}

/** Which credentials are configured server-side — presence only, never values. */
let secretPresence: Record<string, boolean> = {};
export const configuredSecretNames = (): Record<string, boolean> => ({ ...secretPresence });

export async function loadSystemSettingsFromDb(): Promise<Partial<SystemSettingsMap>> {
  const { data, error } = await db.from('system_settings').select('key,value');
  if (error || !data) return {};
  const rows = data as Array<{ key: string; value: string }>;
  secretPresence = Object.fromEntries(
    rows.filter((r) => isCredentialKey(r.key)).map((r) => [r.key, Boolean(r.value)]),
  );
  return Object.fromEntries(rows.map((row) => [row.key, parseValue(row.value)]));
}

/**
 * Reads one credential from server-side storage on demand. Admin-only through
 * RLS; the value is used for the call and never persisted in the browser.
 */
export async function getSecretValue(key: string): Promise<string> {
  const { data } = await db.from('system_settings').select('value').eq('key', key).maybeSingle();
  return (data as { value?: string } | null)?.value || '';
}

export async function loadMergedSystemSettings<T extends SystemSettingsMap>(defaults: T): Promise<T> {
  const local = loadLocalSystemSettings();
  const remote = await loadSystemSettingsFromDb();
  return { ...defaults, ...local, ...remote } as T;
}

export function saveLocalSystemSettings(settings: SystemSettingsMap) {
  // Only non-secret preferences are cached in the browser.
  localStorage.setItem('tivo-hf-url', toStoredValue(settings.backendUrl));
  localStorage.setItem('tivo-default-credits', toStoredValue(settings.defaultUserCredits));
  localStorage.removeItem('tivo-master-secret');
  const { backendUrl, defaultUserCredits, ...rest } = settings;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stripCredentials(rest)));
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
