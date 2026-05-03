// Custom Supabase auto-switch
// Detects user-provided Supabase env vars (set in Vercel/hosting),
// switches the runtime client to use them, and exposes helpers for
// admin-driven schema setup + data migration.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultClient } from '@/integrations/supabase/client';

const LS_PREFER_CUSTOM = 'tivo-prefer-custom-db';

export interface CustomDbConfig {
  url: string;
  anonKey: string;
  // Service-role key is NEVER stored in the browser. Admin pastes it
  // ad-hoc into the migration dialog, then it's sent to the edge function
  // and discarded immediately.
}

/** Read env-supplied custom DB config (publishable values only). */
export function getCustomDbConfig(): CustomDbConfig | null {
  const url = import.meta.env.VITE_CUSTOM_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_CUSTOM_SUPABASE_ANON_KEY as string | undefined;
  if (url && anonKey && url.startsWith('http')) return { url, anonKey };
  return null;
}

/** Whether the runtime should currently prefer the custom DB. */
export function isUsingCustomDb(): boolean {
  if (!getCustomDbConfig()) return false;
  const explicit = localStorage.getItem(LS_PREFER_CUSTOM);
  // Default to ON if env vars are present
  return explicit === null ? true : explicit === '1';
}

export function setUseCustomDb(enabled: boolean): void {
  localStorage.setItem(LS_PREFER_CUSTOM, enabled ? '1' : '0');
}

let _customClient: SupabaseClient | null = null;

/** Active client — either custom or default. */
export function getActiveClient(): SupabaseClient {
  const cfg = getCustomDbConfig();
  if (cfg && isUsingCustomDb()) {
    if (!_customClient) {
      _customClient = createClient(cfg.url, cfg.anonKey, {
        auth: { storage: localStorage, persistSession: true, autoRefreshToken: true },
      });
    }
    return _customClient;
  }
  return defaultClient;
}

/** Trigger schema setup on the custom DB via the edge function. */
export async function setupCustomDb(serviceRoleKey: string): Promise<{ ok: boolean; message: string }> {
  const cfg = getCustomDbConfig();
  if (!cfg) return { ok: false, message: 'No custom DB env vars detected.' };
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/custom-db-setup`;
    const { data: { session } } = await defaultClient.auth.getSession();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        action: 'setup',
        target_url: cfg.url,
        target_service_role_key: serviceRoleKey,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, message: data.error || `Setup failed (${res.status})` };
    return { ok: true, message: data.message || 'Schema created on custom DB.' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Network error' };
  }
}

/** Migrate data from default DB to custom DB via the edge function. */
export async function migrateDataToCustomDb(serviceRoleKey: string): Promise<{ ok: boolean; message: string; stats?: Record<string, number> }> {
  const cfg = getCustomDbConfig();
  if (!cfg) return { ok: false, message: 'No custom DB env vars detected.' };
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/custom-db-setup`;
    const { data: { session } } = await defaultClient.auth.getSession();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        action: 'migrate',
        target_url: cfg.url,
        target_service_role_key: serviceRoleKey,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, message: data.error || `Migration failed (${res.status})` };
    return { ok: true, message: data.message || 'Data migrated.', stats: data.stats };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Network error' };
  }
}

/** Verify the custom DB has expected tables + row counts after migration. */
export async function verifyCustomDb(serviceRoleKey: string): Promise<{
  ok: boolean; message: string; checks?: Record<string, { source: number; target: number; ok: boolean }>;
}> {
  const cfg = getCustomDbConfig();
  if (!cfg) return { ok: false, message: 'No custom DB env vars detected.' };
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/custom-db-setup`;
    const { data: { session } } = await defaultClient.auth.getSession();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        action: 'verify',
        target_url: cfg.url,
        target_service_role_key: serviceRoleKey,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, message: data.error || `Verification failed (${res.status})` };
    return { ok: !!data.ok, message: data.message || 'Verification done.', checks: data.checks };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Network error' };
  }
}
