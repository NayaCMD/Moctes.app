import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as assetPersistence from "../services/assetPersistence";
import { indexedDbAssetStorage } from "../services/assetStorage/indexedDbAssetStorage";
import type { LibraryAsset } from "../types/asset.types";
import { resetStores } from "../test/helpers/resetStores";
import { useLibraryAssetPreview } from "./useLibraryAssetPreview";

vi.mock("../services/assetPersistence", async () => {
  const actual = await vi.importActual<typeof assetPersistence>(
    "../services/assetPersistence",
  );
  return { ...actual, refreshWorkspaceAsset: vi.fn() };
});

const refreshWorkspaceAsset = vi.mocked(
  assetPersistence.refreshWorkspaceAsset,
);

describe("useLibraryAssetPreview", () => {
  beforeEach(async () => {
    resetStores();
    await indexedDbAssetStorage.clearAssetStorage();
    setOnline(true);
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:cached-asset"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    setOnline(true);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders READY built-in assets from the bundled source", () => {
    const asset = builtInAsset();
    const { result } = renderHook(() => useLibraryAssetPreview(asset));

    expect(result.current).toMatchObject({
      availability: "ready",
      src: "/bundled/sticker.svg",
      fromCache: false,
    });
  });

  it("keeps PROCESSING as a non-error state", () => {
    const asset = remoteAsset({ status: "PROCESSING", src: "" });
    const { result } = renderHook(() => useLibraryAssetPreview(asset));

    expect(result.current.availability).toBe("processing");
    expect(refreshWorkspaceAsset).not.toHaveBeenCalled();
  });

  it("uses the IndexedDB blob while offline", async () => {
    const asset = remoteAsset();
    await indexedDbAssetStorage.saveAssetBlob(
      asset.id,
      new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
      asset.updatedAt,
    );
    setOnline(false);

    const { result } = renderHook(() => useLibraryAssetPreview(asset));
    await waitFor(() => expect(result.current.availability).toBe("ready"));

    expect(result.current).toMatchObject({
      src: "blob:cached-asset",
      fromCache: true,
    });
    expect(refreshWorkspaceAsset).not.toHaveBeenCalled();
  });

  it("shows a dedicated offline state when no cache exists", async () => {
    setOnline(false);
    const { result } = renderHook(() =>
      useLibraryAssetPreview(remoteAsset()),
    );

    await waitFor(() => expect(result.current.availability).toBe("offline"));
    expect(result.current.src).toBeNull();
  });

  it("renews an expired signed URL before exposing an error", async () => {
    const refreshed = remoteAsset({
      src: "https://storage.example/fresh",
      thumbnailSrc: "https://storage.example/fresh-thumb",
      downloadExpiresAt: "2099-01-01T00:00:00.000Z",
    });
    refreshWorkspaceAsset.mockResolvedValue({ ok: true, data: refreshed });

    const { result } = renderHook(() =>
      useLibraryAssetPreview(
        remoteAsset({ downloadExpiresAt: "2020-01-01T00:00:00.000Z" }),
      ),
    );

    await waitFor(() =>
      expect(result.current.src).toBe("https://storage.example/fresh-thumb"),
    );
    expect(refreshWorkspaceAsset).toHaveBeenCalledTimes(1);
  });

  it("renews the signed URL once when the image element reports a load failure", async () => {
    refreshWorkspaceAsset.mockResolvedValue({
      ok: true,
      data: remoteAsset({
        src: "https://storage.example/renewed",
        thumbnailSrc: "https://storage.example/renewed-thumb",
      }),
    });
    const asset = remoteAsset();
    const { result } = renderHook(() => useLibraryAssetPreview(asset));

    act(() => result.current.onLoadError());
    await waitFor(() =>
      expect(result.current.src).toBe(
        "https://storage.example/renewed-thumb",
      ),
    );
    expect(refreshWorkspaceAsset).toHaveBeenCalledTimes(1);
  });

  it("does not restart automatic recovery when only the signed URL changes", async () => {
    const original = remoteAsset();
    const renewed = remoteAsset({
      src: "https://storage.example/renewed",
      thumbnailSrc: "https://storage.example/renewed-thumb",
    });
    refreshWorkspaceAsset.mockResolvedValue({ ok: true, data: renewed });
    const { result, rerender } = renderHook(
      ({ asset }: { asset: LibraryAsset }) => useLibraryAssetPreview(asset),
      { initialProps: { asset: original } },
    );

    act(() => result.current.onLoadError());
    await waitFor(() =>
      expect(result.current.src).toBe(
        "https://storage.example/renewed-thumb",
      ),
    );
    act(() => result.current.onLoadError());
    await waitFor(() => expect(result.current.availability).toBe("error"));

    rerender({
      asset: {
        ...renewed,
        thumbnailSrc: "https://storage.example/another-signature",
        downloadExpiresAt: "2099-01-01T01:00:00.000Z",
      },
    });
    await waitFor(() => expect(result.current.availability).toBe("error"));
    expect(refreshWorkspaceAsset).toHaveBeenCalledTimes(1);
  });

  it("distinguishes not found and allows a manual retry after a temporary error", async () => {
    refreshWorkspaceAsset
      .mockResolvedValueOnce({ ok: false, status: 0, error: "network" })
      .mockResolvedValueOnce({
        ok: true,
        data: remoteAsset({
          src: "https://storage.example/recovered",
          thumbnailSrc: "https://storage.example/recovered-thumb",
          downloadExpiresAt: "2099-01-01T00:00:00.000Z",
        }),
      });
    const expired = remoteAsset({
      downloadExpiresAt: "2020-01-01T00:00:00.000Z",
    });
    const { result } = renderHook(() => useLibraryAssetPreview(expired));

    await waitFor(() => expect(result.current.availability).toBe("error"));
    act(() => result.current.retry());
    await waitFor(() =>
      expect(result.current.src).toBe(
        "https://storage.example/recovered-thumb",
      ),
    );
    expect(refreshWorkspaceAsset).toHaveBeenCalledTimes(2);
  });

  it("marks a confirmed 404 as not found", async () => {
    refreshWorkspaceAsset.mockResolvedValue({
      ok: false,
      status: 404,
      error: "not found",
    });
    const { result } = renderHook(() =>
      useLibraryAssetPreview(
        remoteAsset({ downloadExpiresAt: "2020-01-01T00:00:00.000Z" }),
      ),
    );

    await waitFor(() => expect(result.current.availability).toBe("not-found"));
  });
});

function setOnline(online: boolean): void {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}

function builtInAsset(): LibraryAsset {
  return {
    id: "built-in-1",
    folderId: "folder-default-assets",
    type: "sticker",
    name: "Bundled",
    src: "/bundled/sticker.svg",
    mimeType: "image/svg+xml",
    size: 0,
    source: "built-in",
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
  };
}

function remoteAsset(
  updates: Partial<LibraryAsset> = {},
): LibraryAsset {
  return {
    id: "remote-1",
    workspaceId: "workspace-1",
    folderId: "folder-default-assets",
    type: "image",
    name: "Remote image",
    src: "https://storage.example/signed",
    thumbnailSrc: "https://storage.example/signed-thumb",
    downloadExpiresAt: "2099-01-01T00:00:00.000Z",
    mimeType: "image/png",
    size: 3,
    source: "remote",
    status: "READY",
    createdAt: "2026-08-17T00:00:00.000Z",
    updatedAt: "2026-08-17T00:00:00.000Z",
    ...updates,
  };
}
