/**
 * User-specific offline UI state (IndexedDB).
 * Stores only non-sensitive presentation state so the same user can open the
 * PWA with no internet and still see their workspace. Never stores tokens,
 * secrets, passwords or API keys.
 */
const DB_NAME = 'tivo-os-offline';
const STORE = 'ui-state';

const BLOCKED = /(token|secret|password|apikey|api_key|authorization|session|jwt|key)$/i;

function scrub<T>(value: T): T {
  if (Array.isArray(value)) return value.map(scrub) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (BLOCKED.test(k)) continue;
      out[k] = scrub(v);
    }
    return out as T;
  }
  return value;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const scoped = (userId: string | null, key: string) => `${userId || 'anon'}::${key}`;

export async function saveOfflineState(userId: string | null, key: string, value: unknown): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ value: scrub(value), at: new Date().toISOString() }, scoped(userId, key));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* offline storage unavailable — never break the UI */ }
}

export async function loadOfflineState<T>(userId: string | null, key: string): Promise<T | null> {
  try {
    const db = await open();
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(scoped(userId, key));
      req.onsuccess = () => resolve(((req.result as { value?: T })?.value ?? null));
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

export async function clearOfflineState(userId: string | null): Promise<void> {
  try {
    const db = await open();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const keys = await new Promise<IDBValidKey[]>((resolve) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve([]);
    });
    keys.filter((k) => String(k).startsWith(`${userId || 'anon'}::`)).forEach((k) => store.delete(k));
  } catch { /* ignore */ }
}
