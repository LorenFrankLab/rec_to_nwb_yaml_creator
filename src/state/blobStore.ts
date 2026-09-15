/**
 * @fileoverview Large-object side store (IndexedDB) behind the persistence boundary.
 *
 * Why two engines: the autosave blob stays in localStorage because hydration and the final
 * pagehide write must be SYNCHRONOUS (an IndexedDB write started during unload is not guaranteed to
 * commit). But localStorage is ~5 MiB per origin on the smallest supported browser, and the
 * measured representative long study (3 animals × 200 days, 128-channel implants) is ~2.5 MiB per
 * envelope copy and ~16 KiB of exported YAML per day — so the recovery COPIES (checkpoint,
 * pre-migration, quarantine) and the export-receipt YAML bytes cannot also live there. They go
 * here: a plain key → value store in IndexedDB (hundreds of MiB available), read and written
 * asynchronously, never on the hot autosave path.
 *
 * Environments without IndexedDB (jsdom tests, very old browsers) fall back to an in-memory map so
 * callers never branch; durability of the side copies is then session-only (the main blob is
 * unaffected). Framework-free.
 */

const DB_NAME = 'rec_to_nwb_yaml_creator';
const DB_VERSION = 1;
const STORE = 'blobs';

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory = new Map<string, unknown>();

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  if (!hasIndexedDb()) {
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) {
          resolve(undefined);
          return;
        }
        try {
          const tx = db.transaction(STORE, mode);
          const request = run(tx.objectStore(STORE));
          request.onsuccess = () => resolve(request.result as T);
          request.onerror = () => resolve(undefined);
          tx.onabort = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      })
  );
}

/**
 * Store a value under `key` (overwrites). Resolves true when persisted to IndexedDB, false when
 * only the in-memory fallback holds it.
 *
 * @param key - The key.
 * @param value - Any structured-cloneable value.
 * @returns Whether IndexedDB accepted the write.
 */
export async function putBlob(key: string, value: unknown): Promise<boolean> {
  memory.set(key, value);
  if (!hasIndexedDb()) return false;
  const result = await withStore<IDBValidKey>('readwrite', (store) => store.put(value, key));
  return result !== undefined;
}

/**
 * Read a value by key (IndexedDB first, then the in-memory fallback).
 *
 * @param key - The key.
 * @returns The value, or undefined.
 */
export async function getBlob<T = unknown>(key: string): Promise<T | undefined> {
  if (hasIndexedDb()) {
    const stored = await withStore<T>('readonly', (store) => store.get(key));
    if (stored !== undefined) return stored;
  }
  return memory.get(key) as T | undefined;
}

/**
 * Delete a key.
 *
 * @param key - The key.
 */
export async function deleteBlob(key: string): Promise<void> {
  memory.delete(key);
  if (!hasIndexedDb()) return;
  await withStore<undefined>('readwrite', (store) => store.delete(key));
}

/**
 * List the stored keys with a given prefix.
 *
 * @param prefix - Key prefix.
 * @returns Matching keys (IndexedDB ∪ memory).
 */
export async function listBlobKeys(prefix: string): Promise<string[]> {
  const keys = new Set<string>([...memory.keys()].filter((k) => k.startsWith(prefix)));
  if (hasIndexedDb()) {
    const all = await withStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
    (all ?? []).forEach((k) => {
      if (typeof k === 'string' && k.startsWith(prefix)) keys.add(k);
    });
  }
  return [...keys].sort();
}

/** Test-only: clear the in-memory fallback and forget the connection. */
export function resetBlobStoreForTests(): void {
  memory.clear();
  dbPromise = null;
}
