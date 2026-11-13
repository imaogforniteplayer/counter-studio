import type { RestorePoint } from '../core/types';

export type StoreName = 'counters' | 'folders' | 'templates' | 'history' | 'meta' | 'backups';

export const STORE_NAMES: StoreName[] = ['counters', 'folders', 'templates', 'history', 'meta', 'backups'];

export type Op =
  | { type: 'put'; store: StoreName; key: string; value: object }
  | { type: 'delete'; store: StoreName; key: string }
  | { type: 'clear'; store: StoreName };

export interface LoadedData {
  counters: unknown[];
  folders: unknown[];
  templates: unknown[];
  history: unknown[];
  /** meta records by key, e.g. "settings". */
  meta: Record<string, unknown>;
}

export type BackupMeta = Omit<RestorePoint, 'data'>;

export interface Adapter {
  readonly kind: 'indexeddb' | 'memory';
  load(): Promise<LoadedData>;
  /** Apply several writes atomically. */
  apply(ops: Op[]): Promise<void>;
  listBackups(): Promise<BackupMeta[]>;
  getBackup(id: string): Promise<RestorePoint | null>;
}

/** Collapse repeated writes to the same record so a burst of taps becomes one write. */
export function compressOps(ops: Op[]): Op[] {
  const out: (Op | null)[] = [];
  const last = new Map<string, number>();
  for (const op of ops) {
    if (op.type === 'clear') {
      for (let i = 0; i < out.length; i++) {
        const prev = out[i];
        if (prev && prev.store === op.store) out[i] = null;
      }
      for (const key of Array.from(last.keys())) if (key.startsWith(`${op.store}:`)) last.delete(key);
      out.push(op);
      continue;
    }
    const id = `${op.store}:${op.key}`;
    const prevIndex = last.get(id);
    if (prevIndex !== undefined) out[prevIndex] = null;
    last.set(id, out.length);
    out.push(op);
  }
  return out.filter((o): o is Op => o !== null);
}

function stripBackup(b: RestorePoint): BackupMeta {
  const { data: _data, ...meta } = b;
  void _data;
  return meta;
}

/* ---------- memory adapter (tests, and fallback when IndexedDB is unavailable) ---------- */

export function createMemoryAdapter(initial?: Partial<LoadedData>): Adapter & { dump(): Record<StoreName, Map<string, object>> } {
  const stores: Record<StoreName, Map<string, object>> = {
    counters: new Map(),
    folders: new Map(),
    templates: new Map(),
    history: new Map(),
    meta: new Map(),
    backups: new Map(),
  };
  const idOf = (v: unknown, field: string) => String((v as Record<string, unknown>)[field]);
  for (const c of initial?.counters ?? []) stores.counters.set(idOf(c, 'id'), c as object);
  for (const c of initial?.folders ?? []) stores.folders.set(idOf(c, 'id'), c as object);
  for (const c of initial?.templates ?? []) stores.templates.set(idOf(c, 'id'), c as object);
  for (const c of initial?.history ?? []) stores.history.set(idOf(c, 'id'), c as object);
  for (const [key, value] of Object.entries(initial?.meta ?? {})) stores.meta.set(key, { key, value });

  return {
    kind: 'memory',
    async load() {
      const meta: Record<string, unknown> = {};
      for (const [k, v] of stores.meta) meta[k] = (v as { value: unknown }).value;
      return {
        counters: Array.from(stores.counters.values()).map(clone),
        folders: Array.from(stores.folders.values()).map(clone),
        templates: Array.from(stores.templates.values()).map(clone),
        history: Array.from(stores.history.values()).map(clone),
        meta: clone(meta),
      };
    },
    async apply(ops) {
      for (const op of ops) {
        if (op.type === 'put') stores[op.store].set(op.key, clone(op.value));
        else if (op.type === 'delete') stores[op.store].delete(op.key);
        else stores[op.store].clear();
      }
    },
    async listBackups() {
      return Array.from(stores.backups.values()).map((b) => stripBackup(clone(b) as RestorePoint));
    },
    async getBackup(id) {
      const b = stores.backups.get(id);
      return b ? (clone(b) as RestorePoint) : null;
    },
    dump() {
      return stores;
    },
  };
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/* ---------- IndexedDB adapter ---------- */

const DB_NAME = 'tickwell';
const DB_VERSION = 1;

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = factory.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Could not open IndexedDB'));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('counters')) db.createObjectStore('counters', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('templates')) db.createObjectStore('templates', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('history')) {
        const h = db.createObjectStore('history', { keyPath: 'id' });
        h.createIndex('counterId', 'counterId', { unique: false });
        h.createIndex('at', 'at', { unique: false });
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('backups')) db.createObjectStore('backups', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB'));
    req.onblocked = () => reject(new Error('IndexedDB is blocked by another open tab. Close other Tickwell tabs and reload.'));
  });
}

export async function createIdbAdapter(factory: IDBFactory = indexedDB): Promise<Adapter> {
  const db = await openDb(factory);
  db.onversionchange = () => db.close();

  return {
    kind: 'indexeddb',

    async load() {
      const tx = db.transaction(['counters', 'folders', 'templates', 'history', 'meta'], 'readonly');
      const [counters, folders, templates, history, metaRows] = await Promise.all([
        requestToPromise(tx.objectStore('counters').getAll()),
        requestToPromise(tx.objectStore('folders').getAll()),
        requestToPromise(tx.objectStore('templates').getAll()),
        requestToPromise(tx.objectStore('history').getAll()),
        requestToPromise(tx.objectStore('meta').getAll()),
      ]);
      const meta: Record<string, unknown> = {};
      for (const row of metaRows as { key: string; value: unknown }[]) meta[row.key] = row.value;
      return { counters, folders, templates, history, meta };
    },

    apply(ops) {
      if (ops.length === 0) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        const names = Array.from(new Set(ops.map((o) => o.store)));
        let tx: IDBTransaction;
        try {
          tx = db.transaction(names, 'readwrite');
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Could not start a save'));
          return;
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Saving failed'));
        tx.onabort = () => reject(tx.error ?? new Error('Saving was cancelled (storage may be full)'));
        for (const op of ops) {
          const store = tx.objectStore(op.store);
          if (op.type === 'put') store.put(op.value);
          else if (op.type === 'delete') store.delete(op.key);
          else store.clear();
        }
      });
    },

    async listBackups() {
      const tx = db.transaction('backups', 'readonly');
      const all = (await requestToPromise(tx.objectStore('backups').getAll())) as RestorePoint[];
      return all.map(stripBackup);
    },

    async getBackup(id) {
      const tx = db.transaction('backups', 'readonly');
      const row = (await requestToPromise(tx.objectStore('backups').get(id))) as RestorePoint | undefined;
      return row ?? null;
    },
  };
}

/** Open IndexedDB if it works here, otherwise fall back to memory (and say so). */
export async function openBestAdapter(): Promise<Adapter> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is not available');
    return await createIdbAdapter(indexedDB);
  } catch {
    return createMemoryAdapter();
  }
}
