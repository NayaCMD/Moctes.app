import { useAssetLibraryStore } from "../stores/useAssetLibraryStore";
import { useDocumentStore } from "../stores/useDocumentStore";
import type { LibraryAsset } from "../types/asset.types";
import { replaceAssetReferences } from "../utils/assetReferenceMigration.utils";
import { deleteWorkspaceAsset, uploadWorkspaceAsset } from "./assetPersistence";
import { indexedDbAssetStorage } from "./assetStorage/indexedDbAssetStorage";

export interface AssetMigrationResult {
  migrated: number;
  skipped: number;
  failed: number;
}

interface PendingAssetMigration {
  localAssetId: string;
  remoteAssetId: string;
  workspaceId: string;
  createdAt: string;
}

export async function migrateLegacyImportedAssets(options: {
  scope: string;
  workspaceId: string;
  isActive?: () => boolean;
}): Promise<AssetMigrationResult> {
  const result: AssetMigrationResult = { migrated: 0, skipped: 0, failed: 0 };
  result.migrated += await reconcilePendingAssetMigrations(options);
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return result;
  }

  const pendingLocalIds = new Set(
    readPendingMigrations(options.scope).map((entry) => entry.localAssetId),
  );
  const legacyAssets = useAssetLibraryStore
    .getState()
    .assets.filter(
      (asset) =>
        asset.source === "imported" &&
        !pendingLocalIds.has(asset.id) &&
        (!asset.workspaceId || asset.workspaceId === options.workspaceId),
    );

  for (const legacyAsset of legacyAssets) {
    if (options.isActive && !options.isActive()) {
      break;
    }
    const blob = await indexedDbAssetStorage.getAssetBlob(legacyAsset.id);
    if (!blob) {
      result.skipped += 1;
      continue;
    }
    const file = toFile(legacyAsset, blob);
    const uploaded = await uploadWorkspaceAsset({
      workspaceId: options.workspaceId,
      folderId: legacyAsset.folderId,
      type: legacyAsset.type,
      name: legacyAsset.name,
      file,
      width: legacyAsset.width,
      height: legacyAsset.height,
      cacheScope: options.scope,
    });
    if (!uploaded.ok) {
      result.failed += 1;
      continue;
    }
    if (options.isActive && !options.isActive()) {
      await deleteWorkspaceAsset(uploaded.data.id, options.scope);
      break;
    }

    if (uploaded.data.status !== "READY") {
      useAssetLibraryStore.getState().addAsset(uploaded.data);
      writePendingMigrations(options.scope, [
        ...readPendingMigrations(options.scope),
        {
          localAssetId: legacyAsset.id,
          remoteAssetId: uploaded.data.id,
          workspaceId: options.workspaceId,
          createdAt: new Date().toISOString(),
        },
      ]);
      result.skipped += 1;
      continue;
    }

    const library = useAssetLibraryStore.getState();
    const replaced = library.replaceAsset(legacyAsset.id, uploaded.data);
    if (!replaced.ok) {
      await deleteWorkspaceAsset(uploaded.data.id, options.scope);
      result.failed += 1;
      continue;
    }
    const documents = useDocumentStore.getState().documents;
    useDocumentStore
      .getState()
      .applyDocumentsSnapshot(
        replaceAssetReferences(documents, legacyAsset.id, uploaded.data.id),
      );
    await indexedDbAssetStorage.deleteAssetBlob(legacyAsset.id);
    result.migrated += 1;
  }

  return result;
}

export async function reconcilePendingAssetMigrations(options: {
  scope: string;
  workspaceId: string;
  isActive?: () => boolean;
}): Promise<number> {
  const pending = readPendingMigrations(options.scope);
  if (pending.length === 0) {
    return 0;
  }
  const remaining: PendingAssetMigration[] = [];
  let migrated = 0;
  for (const migration of pending) {
    if (migration.workspaceId !== options.workspaceId) {
      remaining.push(migration);
      continue;
    }
    if (options.isActive && !options.isActive()) {
      remaining.push(migration);
      continue;
    }
    const library = useAssetLibraryStore.getState();
    const local = library.assets.find(
      (asset) =>
        asset.id === migration.localAssetId && asset.source === "imported",
    );
    if (!local) {
      continue;
    }
    const remote = library.assets.find(
      (asset) => asset.id === migration.remoteAssetId,
    );
    if (!remote) {
      continue;
    }
    if (remote.status !== "READY") {
      remaining.push(migration);
      continue;
    }

    const replaced = library.replaceAsset(local.id, remote);
    if (!replaced.ok) {
      remaining.push(migration);
      continue;
    }
    const documents = useDocumentStore.getState().documents;
    useDocumentStore
      .getState()
      .applyDocumentsSnapshot(
        replaceAssetReferences(documents, local.id, remote.id),
      );
    await indexedDbAssetStorage.deleteAssetBlob(local.id);
    migrated += 1;
  }
  writePendingMigrations(options.scope, remaining);
  return migrated;
}

function readPendingMigrations(scope: string): PendingAssetMigration[] {
  if (typeof localStorage === "undefined") {
    return [];
  }
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(pendingMigrationKey(scope)) ?? "[]",
    );
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter(isPendingAssetMigration);
  } catch {
    return [];
  }
}

function writePendingMigrations(
  scope: string,
  migrations: PendingAssetMigration[],
): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(pendingMigrationKey(scope), JSON.stringify(migrations));
}

function pendingMigrationKey(scope: string): string {
  return `moctes.asset-migrations.v1:${scope}`;
}

function isPendingAssetMigration(value: unknown): value is PendingAssetMigration {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.localAssetId === "string" &&
    typeof record.remoteAssetId === "string" &&
    typeof record.workspaceId === "string" &&
    typeof record.createdAt === "string"
  );
}

function toFile(asset: LibraryAsset, blob: Blob): File {
  const mimeType = asset.mimeType || blob.type || "application/octet-stream";
  return new File([blob], `${safeFilename(asset.name)}${extension(mimeType)}`, {
    type: mimeType,
    lastModified: Date.now(),
  });
}

function safeFilename(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "asset"
  );
}

function extension(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/svg+xml":
      return ".svg";
    default:
      return "";
  }
}
