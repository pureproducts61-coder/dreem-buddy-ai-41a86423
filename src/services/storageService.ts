// IndexedDB wrapper for offline-first project storage
// Ready for Supabase sync when backend is connected

const DB_NAME = 'dreem-dev-db';
const DB_VERSION = 1;
const PROJECTS_STORE = 'projects';
const CHAT_STORE = 'chat_messages';
const FILES_STORE = 'project_files';

interface DBSchema {
  projects: {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    isFavorite: boolean;
    thumbnail?: string;
    syncStatus: 'local' | 'synced' | 'pending';
  };
  chat_messages: {
    id: string;
    projectId: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  };
  project_files: {
    id: string;
    projectId: string;
    path: string;
    content: string;
    type: 'file' | 'folder';
    updatedAt: string;
  };
}

class StorageService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Projects store
        if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
          const projectsStore = db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
          projectsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          projectsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // Chat messages store
        if (!db.objectStoreNames.contains(CHAT_STORE)) {
          const chatStore = db.createObjectStore(CHAT_STORE, { keyPath: 'id' });
          chatStore.createIndex('projectId', 'projectId', { unique: false });
          chatStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Project files store
        if (!db.objectStoreNames.contains(FILES_STORE)) {
          const filesStore = db.createObjectStore(FILES_STORE, { keyPath: 'id' });
          filesStore.createIndex('projectId', 'projectId', { unique: false });
          filesStore.createIndex('path', 'path', { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  // Generic CRUD operations
  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly') {
    const db = await this.init();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get<T>(storeName: string, id: string): Promise<T | undefined> {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put<T>(storeName: string, data: T): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getByIndex<T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> {
    const store = await this.getStore(storeName);
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Project-specific methods
  async getAllProjects() {
    return this.getAll<DBSchema['projects']>(PROJECTS_STORE);
  }

  async getProject(id: string) {
    return this.get<DBSchema['projects']>(PROJECTS_STORE, id);
  }

  async saveProject(project: DBSchema['projects']) {
    return this.put(PROJECTS_STORE, project);
  }

  async deleteProject(id: string) {
    // Delete project and all related data
    await this.delete(PROJECTS_STORE, id);
    
    // Delete related chat messages
    const messages = await this.getByIndex<DBSchema['chat_messages']>(CHAT_STORE, 'projectId', id);
    for (const msg of messages) {
      await this.delete(CHAT_STORE, msg.id);
    }

    // Delete related files
    const files = await this.getByIndex<DBSchema['project_files']>(FILES_STORE, 'projectId', id);
    for (const file of files) {
      await this.delete(FILES_STORE, file.id);
    }
  }

  // Chat message methods
  async getChatMessages(projectId: string) {
    return this.getByIndex<DBSchema['chat_messages']>(CHAT_STORE, 'projectId', projectId);
  }

  async saveChatMessage(message: DBSchema['chat_messages']) {
    return this.put(CHAT_STORE, message);
  }

  // File methods
  async getProjectFiles(projectId: string) {
    return this.getByIndex<DBSchema['project_files']>(FILES_STORE, 'projectId', projectId);
  }

  async saveProjectFile(file: DBSchema['project_files']) {
    return this.put(FILES_STORE, file);
  }

  // Sync status helpers
  async getPendingSyncItems() {
    const projects = await this.getAllProjects();
    return projects.filter((p) => p.syncStatus === 'pending');
  }

  async markAsSynced(projectId: string) {
    const project = await this.getProject(projectId);
    if (project) {
      project.syncStatus = 'synced';
      await this.saveProject(project);
    }
  }

  // Clear all data
  async clearAll() {
    const db = await this.init();
    const stores = [PROJECTS_STORE, CHAT_STORE, FILES_STORE];
    
    for (const storeName of stores) {
      const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }
}

export const storageService = new StorageService();
export type { DBSchema };
