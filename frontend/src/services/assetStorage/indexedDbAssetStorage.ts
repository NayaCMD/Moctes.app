import type { AssetBlobStorage, StoredAssetBlob } from "./assetStorage.types";

const DB_NAME = "moctes-asset-library";
const DB_VERSION = 1;
const STORE_NAME = "asset-blobs";

const memoryStorage = new Map<string, Blob>();

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openAssetDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "assetId" });
      }
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB error"));
    request.onsuccess = () => resolve(request.result);
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openAssetDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = action(store);

    transaction.oncomplete = () => {
      db.close();
      resolve(request ? request.result : undefined);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("Asset storage transaction failed"));
    };
  });
}

export const indexedDbAssetStorage: AssetBlobStorage = {
  async saveAssetBlob(assetId, blob) {
    if (!hasIndexedDb()) {
      memoryStorage.set(assetId, blob);
      return;
    }

    await runTransaction("readwrite", (store) =>
      store.put({ assetId, blob, updatedAt: new Date().toISOString() } satisfies StoredAssetBlob),
    );
  },

  async getAssetBlob(assetId) {
    if (!hasIndexedDb()) {
      return memoryStorage.get(assetId) ?? null;
    }

    const result = await runTransaction<StoredAssetBlob | undefined>("readonly", (store) =>
      store.get(assetId),
    );
    return result?.blob ?? null;
  },

  async deleteAssetBlob(assetId) {
    if (!hasIndexedDb()) {
      memoryStorage.delete(assetId);
      return;
    }

    await runTransaction("readwrite", (store) => store.delete(assetId));
  },

  async clearAssetStorage() {
    if (!hasIndexedDb()) {
      memoryStorage.clear();
      return;
    }

    await runTransaction("readwrite", (store) => store.clear());
  },
};
