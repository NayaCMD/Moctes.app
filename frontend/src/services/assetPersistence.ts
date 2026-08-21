import type {
  AssetProcessingStatus,
  AssetType,
  LibraryAsset,
} from "../types/asset.types";
import {
  apiDelete,
  apiGet,
  apiPost,
  fetchWithTimeout,
  type ApiResponse,
} from "./apiClient";
import {
  cacheRemoteAssetBlob,
  removeCachedWorkspaceAsset,
  upsertCachedWorkspaceAsset,
} from "./assetOfflineCache";
import { indexedDbAssetStorage } from "./assetStorage/indexedDbAssetStorage";

interface RemoteAssetRecord {
  id: string;
  workspaceId: string;
  folderId: string | null;
  type: AssetType;
  name: string;
  originalFilename: string;
  mimeType: string;
  sourceMimeType: string;
  detectedMimeType: string | null;
  size: number;
  sourceSize: number;
  storageBytes: number;
  width: number | null;
  height: number | null;
  status: AssetProcessingStatus;
  downloadUrl: string | null;
  downloadExpiresAt: string | null;
  thumbnailUrl: string | null;
  processingError: { code: string; message: string } | null;
  createdAt: string;
  updatedAt: string;
}

const assetRefreshes = new Map<string, Promise<ApiResponse<LibraryAsset>>>();

interface AssetUploadRequest {
  workspaceId: string;
  folderId: string;
  type: AssetType;
  name: string;
  file: File;
  width?: number;
  height?: number;
  cacheScope?: string;
}

export interface WorkspaceAssetUsage {
  usedBytes: number;
  limitBytes: number;
  availableBytes: number;
  readyBytes: number;
  pendingBytes: number;
  quarantinedBytes: number;
  assetCount: number;
  assetLimit: number;
  observability: {
    uploadTicketsCreated: number;
    uploadsCompleted: number;
    uploadsRejected: number;
    quotaRejections: number;
    assetsDeleted: number;
    lastCleanupAt: string | null;
    lastCleanupDeleted: number;
    lastCleanupOrphans: number;
    lastCleanupStatus: "ok" | "error" | null;
  };
}

interface AssetUploadTicket {
  asset: RemoteAssetRecord;
  upload: {
    url: string;
    method: "PUT";
    headers: { "Content-Type": string };
    expiresAt: string;
  };
}

export async function loadWorkspaceAssets(
  workspaceId: string,
): Promise<ApiResponse<LibraryAsset[]>> {
  const assets: RemoteAssetRecord[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const params = new URLSearchParams({ workspaceId, limit: "100" });
    if (cursor) params.set("cursor", cursor);
    const response = await apiGet<
      | RemoteAssetRecord[]
      | { items: RemoteAssetRecord[]; nextCursor: string | null }
    >(`/assets?${params.toString()}`);
    if (!response.ok) return response;
    if (Array.isArray(response.data)) {
      assets.push(...response.data);
      cursor = null;
    } else {
      assets.push(...response.data.items);
      cursor = response.data.nextCursor;
      if (cursor && seenCursors.has(cursor)) {
        return {
          ok: false,
          status: 502,
          error: "Asset pagination returned a repeated cursor.",
        };
      }
      if (cursor) seenCursors.add(cursor);
    }
  } while (cursor);
  return { ok: true, data: assets.map(toLibraryAsset) };
}

export function refreshWorkspaceAsset(
  assetId: string,
): Promise<ApiResponse<LibraryAsset>> {
  const current = assetRefreshes.get(assetId);
  if (current) {
    return current;
  }

  const refresh = apiGet<RemoteAssetRecord>(
    `/assets/${encodeURIComponent(assetId)}`,
  )
    .then((response): ApiResponse<LibraryAsset> =>
      response.ok
        ? { ok: true, data: toLibraryAsset(response.data) }
        : response,
    )
    .finally(() => assetRefreshes.delete(assetId));
  assetRefreshes.set(assetId, refresh);
  return refresh;
}

export function loadWorkspaceAssetUsage(
  workspaceId: string,
): Promise<ApiResponse<WorkspaceAssetUsage>> {
  return apiGet<WorkspaceAssetUsage>(
    `/assets/usage?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
}

export async function uploadWorkspaceAsset(
  request: AssetUploadRequest,
): Promise<ApiResponse<LibraryAsset>> {
  const ticket = await apiPost<
    Omit<AssetUploadRequest, "file"> & {
      originalFilename: string;
      mimeType: string;
      size: number;
    },
    AssetUploadTicket
  >("/assets/uploads", {
    workspaceId: request.workspaceId,
    folderId: request.folderId,
    type: request.type,
    name: request.name,
    originalFilename: request.file.name,
    mimeType: request.file.type,
    size: request.file.size,
    width: request.width,
    height: request.height,
  });
  if (!ticket.ok) {
    return ticket;
  }

  try {
    const upload = await fetchWithTimeout(
      ticket.data.upload.url,
      {
        method: ticket.data.upload.method,
        headers: ticket.data.upload.headers,
        body: request.file,
      },
      60_000,
    );
    if (!upload.ok) {
      await apiDelete(`/assets/${encodeURIComponent(ticket.data.asset.id)}`);
      return {
        ok: false,
        status: upload.status,
        error: "O object storage recusou o upload do arquivo.",
      };
    }
  } catch (error) {
    await apiDelete(`/assets/${encodeURIComponent(ticket.data.asset.id)}`);
    return {
      ok: false,
      status: 0,
      error:
        error instanceof Error ? error.message : "Falha no upload do arquivo.",
    };
  }

  const completed = await apiPost<undefined, RemoteAssetRecord>(
    `/assets/${encodeURIComponent(ticket.data.asset.id)}/complete`,
  );
  if (!completed.ok) {
    await apiDelete(`/assets/${encodeURIComponent(ticket.data.asset.id)}`);
    return completed;
  }
  if (
    completed.data.status !== "PROCESSING" &&
    completed.data.status !== "READY"
  ) {
    return {
      ok: false,
      status: 422,
      error: "O asset não pôde ser encaminhado para processamento.",
    };
  }
  const asset = toLibraryAsset(completed.data);
  await Promise.allSettled([
    asset.status === "READY" ? cacheRemoteAssetBlob(asset) : Promise.resolve(),
    request.cacheScope
      ? upsertCachedWorkspaceAsset(request.cacheScope, asset)
      : Promise.resolve(),
  ]);
  return { ok: true, data: asset };
}

export async function deleteWorkspaceAsset(
  assetId: string,
  cacheScope?: string,
): Promise<ApiResponse<null>> {
  const response = await apiDelete<null>(
    `/assets/${encodeURIComponent(assetId)}`,
  );
  if (response.ok) {
    if (cacheScope) {
      await removeCachedWorkspaceAsset(cacheScope, assetId);
    } else {
      await indexedDbAssetStorage.deleteAssetBlob(assetId);
    }
  }
  return response;
}

function toLibraryAsset(asset: RemoteAssetRecord): LibraryAsset {
  return {
    id: asset.id,
    workspaceId: asset.workspaceId,
    folderId: asset.folderId ?? "folder-default-assets",
    type: asset.type,
    name: asset.name,
    src: asset.downloadUrl ?? "",
    thumbnailSrc: asset.thumbnailUrl ?? undefined,
    mimeType: asset.mimeType,
    size: asset.size,
    source: "remote",
    status: asset.status,
    processingError: asset.processingError ?? undefined,
    downloadExpiresAt: asset.downloadExpiresAt ?? undefined,
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}
