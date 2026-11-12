import type { StateStorage } from 'zustand/middleware';

/**
 * Armazenamento do Life RPG no IndexedDB (as fotos dos itens não cabem nos ~5 MB do localStorage).
 * Leitura cai no localStorage quando o IndexedDB ainda não tem nada: é onde a versão 1 gravava.
 */
const DB = 'life-rpg';
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const idbStorage: StateStorage = {
  getItem: async (key) => {
    try {
      const v = await run<string | undefined>('readonly', (s) => s.get(key));
      if (v != null) return v;
    } catch {
      /* sem IndexedDB: segue no localStorage */
    }
    return localStorage.getItem(key);
  },
  setItem: async (key, value) => {
    try {
      await run('readwrite', (s) => s.put(value, key));
    } catch {
      localStorage.setItem(key, value);
    }
  },
  removeItem: async (key) => {
    try {
      await run('readwrite', (s) => s.delete(key));
    } catch {
      /* nada */
    }
    localStorage.removeItem(key);
  },
};

/** Reduz a foto (lado maior 720px, WebP) antes de guardar: ~30–80 KB por item */
export async function compressImage(file: Blob, max = 720, quality = 0.82): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.toDataURL('image/webp', quality);
}
