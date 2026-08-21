import type { LibraryAsset } from "../../types/asset.types";
import type {
  AssetBlobStorage,
  CachedWorkspaceAssets,
  StoredAssetBlob,
} from "./assetStorage.types";

const DB_NAME = "moctes-asset-library";
const DB_VERSION = 2;
const BLOB_STORE_NAME = "asset-blobs";
const WORKSPACE_STORE_NAME = "workspace-assets";

const memoryStorage = new Map<string, StoredAssetBlob>();
const memoryWorkspaceAssets = new Map<string, LibraryAsset[]>();

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openAssetDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BLOB_STORE_NAME)) {
        db.createObjectStore(BLOB_STORE_NAME, { keyPath: "assetId" });
      }
      if (!db.objectStoreNames.contains(WORKSPACE_STORE_NAME)) {
        db.createObjectStore(WORKSPACE_STORE_NAME, { keyPath: "scope" });
      }
    };
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB error"));
    request.onsuccess = () => resolve(request.result);
  });
}

async function runTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openAssetDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = action(store);

    transaction.oncomplete = () => {
      db.close();
      resolve(request ? request.result : undefined);
    };
    transaction.onerror = () => {
      db.close();
      reject(
        transaction.error ?? new Error("Asset storage transaction failed"),
      );
    };
  });
}

export const indexedDbAssetStorage: AssetBlobStorage = {
  async saveAssetBlob(assetId, blob, version) {
    const record = {
      assetId,
      blob,
      updatedAt: new Date().toISOString(),
      version,
    } satisfies StoredAssetBlob;
    if (!hasIndexedDb()) {
      memoryStorage.set(assetId, record);
      return;
    }

    await runTransaction(BLOB_STORE_NAME, "readwrite", (store) =>
      store.put(record),
    );
  },

  async getAssetBlob(assetId) {
    return (await this.getAssetBlobRecord(assetId))?.blob ?? null;
  },

  async getAssetBlobRecord(assetId) {
    if (!hasIndexedDb()) {
      return memoryStorage.get(assetId) ?? null;
    }

    const result = await runTransaction<StoredAssetBlob | undefined>(
      BLOB_STORE_NAME,
      "readonly",
      (store) => store.get(assetId),
    );
    return result ?? null;
  },

  async deleteAssetBlob(assetId) {
    if (!hasIndexedDb()) {
      memoryStorage.delete(assetId);
      return;
    }

    await runTransaction(BLOB_STORE_NAME, "readwrite", (store) =>
      store.delete(assetId),
    );
  },

  async clearAssetStorage() {
    if (!hasIndexedDb()) {
      memoryStorage.clear();
      memoryWorkspaceAssets.clear();
      return;
    }

    await Promise.all([
      runTransaction(BLOB_STORE_NAME, "readwrite", (store) => store.clear()),
      runTransaction(WORKSPACE_STORE_NAME, "readwrite", (store) =>
        store.clear(),
      ),
    ]);
  },

  async saveWorkspaceAssets(scope, assets) {
    const snapshot = assets.map(cloneAsset);
    if (!hasIndexedDb()) {
      memoryWorkspaceAssets.set(scope, snapshot);
      return;
    }
    await runTransaction(WORKSPACE_STORE_NAME, "readwrite", (store) =>
      store.put({
        scope,
        assets: snapshot,
        updatedAt: new Date().toISOString(),
      } satisfies CachedWorkspaceAssets),
    );
  },

  async getWorkspaceAssets(scope) {
    if (!hasIndexedDb()) {
      return (memoryWorkspaceAssets.get(scope) ?? []).map(cloneAsset);
    }
    const result = await runTransaction<CachedWorkspaceAssets | undefined>(
      WORKSPACE_STORE_NAME,
      "readonly",
      (store) => store.get(scope),
    );
    return (result?.assets ?? []).map(cloneAsset);
  },

  async removeWorkspaceAsset(scope, assetId) {
    const assets = await this.getWorkspaceAssets(scope);
    await this.saveWorkspaceAssets(
      scope,
      assets.filter((asset) => asset.id !== assetId),
    );
  },
};

function cloneAsset(asset: LibraryAsset): LibraryAsset {
  return { ...asset };
}
