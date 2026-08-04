/**
 * Generic local-first reactive registry.
 * Backed by localStorage so everything survives restart and works offline.
 * Used by the Model Manager, AI Constitution, Bridge permissions and Plugins.
 */

type Listener = () => void;

export interface RegistryRecord {
  id: string;
  [key: string]: unknown;
}

export class LocalRegistry<T extends RegistryRecord> {
  private key: string;
  private seed: T[];
  private cache: T[] | null = null;
  private listeners = new Set<Listener>();

  constructor(key: string, seed: T[] = []) {
    this.key = key;
    this.seed = seed;
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === this.key) {
          this.cache = null;
          this.emit();
        }
      });
    }
  }

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  private emit() {
    this.listeners.forEach((l) => l());
  }

  getAll = (): T[] => {
    if (this.cache) return this.cache;
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        this.cache = JSON.parse(raw) as T[];
      } else {
        this.cache = [...this.seed];
        localStorage.setItem(this.key, JSON.stringify(this.cache));
      }
    } catch {
      this.cache = [...this.seed];
    }
    return this.cache;
  };

  private write(next: T[]) {
    this.cache = next;
    try { localStorage.setItem(this.key, JSON.stringify(next)); } catch { /* quota */ }
    this.emit();
  }

  get = (id: string) => this.getAll().find((r) => r.id === id) ?? null;

  add = (record: Omit<T, 'id'> & { id?: string }): T => {
    const item = { ...record, id: record.id || crypto.randomUUID() } as T;
    this.write([...this.getAll(), item]);
    return item;
  };

  update = (id: string, patch: Partial<T>) => {
    this.write(this.getAll().map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  remove = (id: string) => {
    this.write(this.getAll().filter((r) => r.id !== id));
  };

  replaceAll = (records: T[]) => this.write(records);

  reset = () => this.write([...this.seed]);

  exportJson = () => JSON.stringify(this.getAll(), null, 2);

  importJson = (json: string, mode: 'merge' | 'replace' = 'merge') => {
    const parsed = JSON.parse(json) as T[];
    if (!Array.isArray(parsed)) throw new Error('Invalid registry payload');
    if (mode === 'replace') { this.write(parsed); return parsed.length; }
    const byId = new Map(this.getAll().map((r) => [r.id, r]));
    parsed.forEach((r) => byId.set(r.id, { ...(byId.get(r.id) || {}), ...r } as T));
    this.write([...byId.values()]);
    return parsed.length;
  };
}