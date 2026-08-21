import { useCallback, useEffect, useRef, useState } from "react";
import {
  cacheRemoteAssetBlob,
} from "../services/assetOfflineCache";
import { reportAssetDiagnostic } from "../services/assetDiagnostics";
import { refreshWorkspaceAsset } from "../services/assetPersistence";
import { indexedDbAssetStorage } from "../services/assetStorage/indexedDbAssetStorage";
import { useAssetLibraryStore } from "../stores/useAssetLibraryStore";
import type {
  AssetAvailability,
  LibraryAsset,
} from "../types/asset.types";
import { availabilityFromProcessingStatus } from "../utils/assetAvailability.utils";
import { IMPORTED_ASSET_SRC_PREFIX } from "../utils/assetLibrary.utils";
import { useOnlineStatus } from "./useOnlineStatus";

const EXPIRY_SAFETY_WINDOW_MS = 30_000;

export interface AssetPreviewResult {
  availability: AssetAvailability;
  src: string | null;
  fromCache: boolean;
  processingError?: { code: string; message: string };
  canRetry: boolean;
  retry: () => void;
  onLoadError: () => void;
}

export function useLibraryAssetPreview(
  asset: LibraryAsset | null | undefined,
): AssetPreviewResult {
  return useAssetPreview(asset, {
    assetIdHint: asset?.id,
    fallbackSrc: "",
    purpose: "thumbnail",
  });
}

export function useElementAssetPreview(
  assetId: string | undefined,
  fallbackSrc: string,
): AssetPreviewResult {
  const asset = useAssetLibraryStore((state) =>
    assetId ? state.assets.find((item) => item.id === assetId) : undefined,
  );
  return useAssetPreview(asset, {
    assetIdHint: assetId,
    fallbackSrc,
    purpose: "content",
  });
}

function useAssetPreview(
  asset: LibraryAsset | undefined | null,
  options: {
    assetIdHint?: string;
    fallbackSrc: string;
    purpose: "thumbnail" | "content";
  },
): AssetPreviewResult {
  const online = useOnlineStatus();
  const assetRef = useRef(asset);
  useEffect(() => {
    assetRef.current = asset;
  }, [asset]);
  const upsertRemoteAsset = useAssetLibraryStore(
    (state) => state.upsertRemoteAsset,
  );
  const [retryToken, setRetryToken] = useState(0);
  const forceRefreshRef = useRef(false);
  const automaticRecoveryVersionsRef = useRef(new Set<string>());
  const blockedVersionsRef = useRef(new Set<string>());
  const missingLookupsRef = useRef(new Set<string>());
  const [resolution, setResolution] = useState(() =>
    initialResolution(asset, options.fallbackSrc, online, options.purpose),
  );

  useEffect(() => {
    const currentAsset = assetRef.current;
    let active = true;
    let createdObjectUrl: string | null = null;
    const update = (next: PreviewResolution) => {
      if (active) {
        setResolution(next);
      }
    };
    const applyBlob = (blob: Blob) => {
      if (typeof URL.createObjectURL !== "function") {
        return false;
      }
      createdObjectUrl = URL.createObjectURL(blob);
      update({ availability: "ready", src: createdObjectUrl, fromCache: true });
      return true;
    };

    const applyRefresh = async (assetId: string) => {
      const response = await refreshWorkspaceAsset(assetId);
      if (!active) {
        return;
      }
      if (!response.ok) {
        if (response.status === 404) {
          reportAssetDiagnostic({
            event: "preview-not-found",
            assetId,
            source: currentAsset?.source ?? "document-reference",
            status: response.status,
          });
          update({ availability: "not-found", src: null, fromCache: false });
          return;
        }
        reportAssetDiagnostic({
          event: "preview-refresh-failed",
          assetId,
          source: currentAsset?.source ?? "document-reference",
          status: response.status,
        });
        update({
          availability: online ? "error" : "offline",
          src: null,
          fromCache: false,
        });
        return;
      }

      upsertRemoteAsset(response.data);
      const lifecycle = availabilityFromProcessingStatus(response.data.status);
      if (lifecycle) {
        update({ availability: lifecycle, src: null, fromCache: false });
        return;
      }
      const source = sourceForPurpose(response.data, options.purpose);
      if (!source) {
        update({ availability: "error", src: null, fromCache: false });
        return;
      }
      update({ availability: "ready", src: source, fromCache: false });
      void cacheRemoteAssetBlob(response.data);
    };

    const resolve = async () => {
      const lifecycle = availabilityFromProcessingStatus(currentAsset?.status);
      if (lifecycle) {
        forceRefreshRef.current = false;
        update({ availability: lifecycle, src: null, fromCache: false });
        return;
      }

      if (!currentAsset) {
        const usableFallback = isUsableFallback(options.fallbackSrc);
        if (usableFallback) {
          update({
            availability: "ready",
            src: options.fallbackSrc,
            fromCache: false,
          });
          return;
        }
        if (options.assetIdHint && online) {
          const lookupKey = `${options.assetIdHint}:${retryToken}`;
          if (!missingLookupsRef.current.has(lookupKey)) {
            missingLookupsRef.current.add(lookupKey);
            update({ availability: "loading", src: null, fromCache: false });
            await applyRefresh(options.assetIdHint);
            return;
          }
        }
        update({
          availability: online ? "not-found" : "offline",
          src: null,
          fromCache: false,
        });
        return;
      }

      if (currentAsset.source === "built-in") {
        forceRefreshRef.current = false;
        update(
          currentAsset.src
            ? { availability: "ready", src: currentAsset.src, fromCache: false }
            : { availability: "not-found", src: null, fromCache: false },
        );
        return;
      }

      const cached = await indexedDbAssetStorage.getAssetBlobRecord(currentAsset.id);
      if (!active) {
        return;
      }
      const cacheIsCurrent = cached?.version === currentAsset.updatedAt;
      if (
        cached &&
        (!online || currentAsset.source === "imported" || cacheIsCurrent)
      ) {
        forceRefreshRef.current = false;
        if (applyBlob(cached.blob)) {
          return;
        }
      }

      if (currentAsset.source === "imported") {
        forceRefreshRef.current = false;
        update({
          availability: online ? "not-found" : "offline",
          src: null,
          fromCache: false,
        });
        return;
      }

      if (!online) {
        update({ availability: "offline", src: null, fromCache: false });
        return;
      }

      const versionKey = assetVersionKey(currentAsset);
      if (
        blockedVersionsRef.current.has(versionKey) &&
        !forceRefreshRef.current
      ) {
        update({ availability: "error", src: null, fromCache: false });
        return;
      }

      const source = sourceForPurpose(currentAsset, options.purpose);
      const shouldRefresh =
        forceRefreshRef.current || !source || signedUrlExpiresSoon(currentAsset);
      forceRefreshRef.current = false;
      if (shouldRefresh) {
        update({ availability: "loading", src: null, fromCache: false });
        await applyRefresh(currentAsset.id);
        return;
      }

      update({ availability: "ready", src: source, fromCache: false });
      void cacheRemoteAssetBlob(currentAsset);
    };

    void resolve();
    return () => {
      active = false;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [
    asset?.downloadExpiresAt,
    asset?.id,
    asset?.mimeType,
    asset?.size,
    asset?.source,
    asset?.src,
    asset?.status,
    asset?.thumbnailSrc,
    asset?.updatedAt,
    online,
    options.assetIdHint,
    options.fallbackSrc,
    options.purpose,
    retryToken,
    upsertRemoteAsset,
  ]);

  const retry = useCallback(() => {
    const currentAsset = assetRef.current;
    if (currentAsset?.source === "remote") {
      const versionKey = assetVersionKey(currentAsset);
      blockedVersionsRef.current.delete(versionKey);
      automaticRecoveryVersionsRef.current.add(versionKey);
    }
    forceRefreshRef.current = true;
    setResolution({ availability: "loading", src: null, fromCache: false });
    setRetryToken((value) => value + 1);
  }, []);

  const onLoadError = useCallback(() => {
    const failedSource = resolution.src;
    if (!failedSource) {
      return;
    }
    reportAssetDiagnostic({
      event: "preview-load-failed",
      assetId: asset?.id ?? options.assetIdHint,
      source: asset?.source ?? "document-reference",
    });
    if (asset?.source === "remote" && online) {
      const versionKey = assetVersionKey(asset);
      if (!automaticRecoveryVersionsRef.current.has(versionKey)) {
        automaticRecoveryVersionsRef.current.add(versionKey);
        forceRefreshRef.current = true;
        setResolution({
          availability: "loading",
          src: null,
          fromCache: false,
        });
        setRetryToken((value) => value + 1);
        return;
      }
      blockedVersionsRef.current.add(versionKey);
    }
    setResolution({
      availability: online ? "error" : "offline",
      src: null,
      fromCache: false,
    });
  }, [asset, online, options.assetIdHint, resolution.src]);

  return {
    ...resolution,
    processingError: asset?.processingError,
    canRetry:
      resolution.availability === "error" ||
      resolution.availability === "not-found" ||
      (resolution.availability === "offline" && online),
    retry,
    onLoadError,
  };
}

interface PreviewResolution {
  availability: AssetAvailability;
  src: string | null;
  fromCache: boolean;
}

function initialResolution(
  asset: LibraryAsset | null | undefined,
  fallbackSrc: string,
  online: boolean,
  purpose: "thumbnail" | "content",
): PreviewResolution {
  const lifecycle = availabilityFromProcessingStatus(asset?.status);
  if (lifecycle) {
    return { availability: lifecycle, src: null, fromCache: false };
  }
  if (asset?.source === "built-in") {
    return asset.src
      ? { availability: "ready", src: asset.src, fromCache: false }
      : { availability: "not-found", src: null, fromCache: false };
  }
  if (asset?.source === "remote" && online) {
    const source = sourceForPurpose(asset, purpose);
    if (source && !signedUrlExpiresSoon(asset)) {
      return { availability: "ready", src: source, fromCache: false };
    }
  }
  if (!asset && isUsableFallback(fallbackSrc)) {
    return { availability: "ready", src: fallbackSrc, fromCache: false };
  }
  return { availability: "loading", src: null, fromCache: false };
}

function sourceForPurpose(
  asset: LibraryAsset,
  purpose: "thumbnail" | "content",
): string {
  return purpose === "thumbnail"
    ? (asset.thumbnailSrc ?? asset.src)
    : asset.src;
}

function signedUrlExpiresSoon(asset: LibraryAsset): boolean {
  if (!asset.downloadExpiresAt) {
    return false;
  }
  const expiresAt = Date.parse(asset.downloadExpiresAt);
  return (
    Number.isFinite(expiresAt) &&
    expiresAt <= Date.now() + EXPIRY_SAFETY_WINDOW_MS
  );
}

function isUsableFallback(src: string): boolean {
  return Boolean(src) && !src.startsWith(IMPORTED_ASSET_SRC_PREFIX);
}

function assetVersionKey(asset: Pick<LibraryAsset, "id" | "updatedAt">): string {
  return `${asset.id}:${asset.updatedAt}`;
}
