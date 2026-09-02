/**
 * Minimal IndexedDB key/value store used for structured, potentially large
 * offline-first state (registries, project files, chat history, outbox).
 *
 * localStorage stays as a synchronous fast path for small records, but IndexedDB
 * is the durable mirror: it has no ~5MB cap and survives larger payloads.
 * Every call fails soft — a browser without IndexedDB simply keeps localStorage.
 */

const DB_NAME = 'tivo-os';
const DB_VERSION = 1;
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const t = db.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export const idbGet = <T>(key: string) => tx<T>('readonly', (s) => s.get(key));
export const idbSet = (key: string, value: unknown) => tx('readwrite', (s) => s.put(value, key));
export const idbDel = (key: string) => tx('readwrite', (s) => s.delete(key));
export const idbKeys = () => tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys());

/** True when IndexedDB is actually usable in this runtime (real detection). */
export async function idbAvailable(): Promise<boolean> {
  const db = await openDb();
  return Boolean(db);
}
