import type { LibraryAsset } from "../types/asset.types";
import { indexedDbAssetStorage } from "./assetStorage/indexedDbAssetStorage";
import { fetchWithTimeout } from "./apiClient";

const DOWNLOAD_CONCURRENCY = 3;
const activeDownloads = new Map<string, Promise<void>>();

export async function loadCachedWorkspaceAssets(options: {
  scope: string;
  workspaceId: string;
  legacyAssets?: LibraryAsset[];
}): Promise<LibraryAsset[]> {
  const cached = await indexedDbAssetStorage.getWorkspaceAssets(options.scope);
  if (cached.length > 0) {
    return cached.filter(
      (asset) =>
        asset.source === "remote" && asset.workspaceId === options.workspaceId,
    );
  }

  const legacy = (options.legacyAssets ?? []).filter(
    (asset) =>
      asset.source === "remote" && asset.workspaceId === options.workspaceId,
  );
  if (legacy.length > 0) {
    await indexedDbAssetStorage.saveWorkspaceAssets(options.scope, legacy);
  }
  return legacy;
}

export async function cacheWorkspaceAssets(
  scope: string,
  assets: LibraryAsset[],
): Promise<void> {
  const remoteAssets = assets.filter((asset) => asset.source === "remote");
  const previous = await indexedDbAssetStorage.getWorkspaceAssets(scope);
  await indexedDbAssetStorage.saveWorkspaceAssets(scope, remoteAssets);
  const currentIds = new Set(remoteAssets.map((asset) => asset.id));
  await Promise.all(
    previous
      .filter((asset) => !currentIds.has(asset.id))
      .map((asset) => indexedDbAssetStorage.deleteAssetBlob(asset.id)),
  );
  await mapWithConcurrency(
    remoteAssets,
    DOWNLOAD_CONCURRENCY,
    cacheRemoteAssetBlob,
  );
}

export async function upsertCachedWorkspaceAsset(
  scope: string,
  asset: LibraryAsset,
): Promise<void> {
  const cached = await indexedDbAssetStorage.getWorkspaceAssets(scope);
  await indexedDbAssetStorage.saveWorkspaceAssets(scope, [
    ...cached.filter((item) => item.id !== asset.id),
    asset,
  ]);
}

export async function removeCachedWorkspaceAsset(
  scope: string,
  assetId: string,
): Promise<void> {
  await Promise.all([
    indexedDbAssetStorage.deleteAssetBlob(assetId),
    indexedDbAssetStorage.removeWorkspaceAsset(scope, assetId),
  ]);
}

export async function cacheRemoteAssetBlob(asset: LibraryAsset): Promise<void> {
  if (asset.source !== "remote" || !asset.src) {
    return;
  }
  const downloadKey = `${asset.id}:${asset.updatedAt}`;
  const current = activeDownloads.get(downloadKey);
  if (current) {
    return current;
  }

  const download = downloadRemoteAssetBlob(asset).finally(() =>
    activeDownloads.delete(downloadKey),
  );
  activeDownloads.set(downloadKey, download);
  return download;
}

async function downloadRemoteAssetBlob(asset: LibraryAsset): Promise<void> {
  const cached = await indexedDbAssetStorage.getAssetBlobRecord(asset.id);
  if (cached?.version === asset.updatedAt) {
    return;
  }
  try {
    const response = await fetchWithTimeout(
      asset.src,
      { credentials: "omit" },
      20_000,
    );
    if (!response.ok) {
      return;
    }
    const blob = await response.blob();
    if (blob.size !== asset.size || blob.type !== asset.mimeType) {
      return;
    }
    await indexedDbAssetStorage.saveAssetBlob(asset.id, blob, asset.updatedAt);
  } catch {
    // A signed URL can be unavailable while offline; the previous cache remains valid.
  }
}

async function mapWithConcurrency<T>(
  values: T[],
  concurrency: number,
  action: (value: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const value = values[nextIndex];
        nextIndex += 1;
        await action(value);
      }
    },
  );
  await Promise.all(workers);
}
