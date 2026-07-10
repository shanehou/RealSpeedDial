import { THUMB_DB_NAME, THUMB_DB_VERSION, THUMB_STORE, ASSET_STORE } from './constants';
import type { ThumbnailRecord } from '@/types';

export interface PendingThumbnailCapture {
  sourceUrl: string;
  dataUrl: string;
  capturedAt: number;
}

const PENDING_CAPTURE_PREFIX = 'pending-thumbnail:';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(THUMB_DB_NAME, THUMB_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(THUMB_STORE)) {
        db.createObjectStore(THUMB_STORE, { keyPath: 'url' });
      }
      if (!db.objectStoreNames.contains(ASSET_STORE)) {
        db.createObjectStore(ASSET_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    let result: T;
    req.onsuccess = () => { result = req.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error ?? req.error);
    t.onabort = () => reject(t.error ?? req.error);
  }));
}

export async function getThumbnail(url: string): Promise<ThumbnailRecord | undefined> {
  return tx<ThumbnailRecord | undefined>(THUMB_STORE, 'readonly', (s) => s.get(url) as IDBRequest<ThumbnailRecord | undefined>);
}

export async function putThumbnail(rec: ThumbnailRecord): Promise<void> {
  await tx(THUMB_STORE, 'readwrite', (s) => s.put(rec));
}

export async function deleteThumbnail(url: string): Promise<void> {
  await tx(THUMB_STORE, 'readwrite', (s) => s.delete(url));
}

export async function putAsset(key: string, blob: Blob): Promise<void> {
  await tx(ASSET_STORE, 'readwrite', (s) => s.put(blob, key));
}

export async function getAsset(key: string): Promise<Blob | undefined> {
  return tx<Blob | undefined>(ASSET_STORE, 'readonly', (s) => s.get(key) as IDBRequest<Blob | undefined>);
}

export async function putPendingCapture(id: string, capture: PendingThumbnailCapture): Promise<void> {
  await tx(ASSET_STORE, 'readwrite', (s) => s.put(capture, `${PENDING_CAPTURE_PREFIX}${id}`));
}

export async function getPendingCapture(id: string): Promise<PendingThumbnailCapture | undefined> {
  return tx<PendingThumbnailCapture | undefined>(
    ASSET_STORE,
    'readonly',
    (s) => s.get(`${PENDING_CAPTURE_PREFIX}${id}`) as IDBRequest<PendingThumbnailCapture | undefined>,
  );
}

export async function deletePendingCapture(id: string): Promise<void> {
  await tx(ASSET_STORE, 'readwrite', (s) => s.delete(`${PENDING_CAPTURE_PREFIX}${id}`));
}
