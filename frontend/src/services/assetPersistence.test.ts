import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as apiClient from "./apiClient";
import {
  loadWorkspaceAssets,
  refreshWorkspaceAsset,
  uploadWorkspaceAsset,
} from "./assetPersistence";

vi.mock("./apiClient", async () => {
  const actual =
    await vi.importActual<typeof import("./apiClient")>("./apiClient");
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiDelete: vi.fn(),
  };
});

const apiGet = vi.mocked(apiClient.apiGet);
const apiPost = vi.mocked(apiClient.apiPost);
const apiDelete = vi.mocked(apiClient.apiDelete);

describe("asset persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiDelete.mockResolvedValue({ ok: true, data: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps ready workspace assets to the shared library", async () => {
    apiGet.mockResolvedValue({ ok: true, data: [remoteAsset()] });

    const response = await loadWorkspaceAssets("workspace-1");

    expect(apiGet).toHaveBeenCalledWith(
      "/assets?workspaceId=workspace-1&limit=100",
    );
    expect(response).toMatchObject({
      ok: true,
      data: [
        {
          id: "asset-1",
          workspaceId: "workspace-1",
          source: "remote",
          src: "https://storage.example/download",
          downloadExpiresAt: "2026-08-12T03:00:00.000Z",
        },
      ],
    });
  });

  it("deduplicates concurrent signed URL refreshes", async () => {
    let resolveRequest:
      | ((value: { ok: true; data: ReturnType<typeof remoteAsset> }) => void)
      | undefined;
    apiGet.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const first = refreshWorkspaceAsset("asset-refresh");
    const second = refreshWorkspaceAsset("asset-refresh");
    resolveRequest?.({
      ok: true,
      data: { ...remoteAsset(), id: "asset-refresh" },
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ ok: true }),
      expect.objectContaining({ ok: true }),
    ]);
    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(apiGet).toHaveBeenCalledWith("/assets/asset-refresh");
  });

  it("stops when the asset API repeats a pagination cursor", async () => {
    apiGet.mockResolvedValue({
      ok: true,
      data: { items: [remoteAsset()], nextCursor: "asset-1" },
    });

    await expect(loadWorkspaceAssets("workspace-1")).resolves.toMatchObject({
      ok: false,
      status: 502,
    });
    expect(apiGet).toHaveBeenCalledTimes(2);
  });

  it("uploads directly with the signed PUT and returns the processing state", async () => {
    const uploadFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", uploadFetch);
    apiPost
      .mockResolvedValueOnce({
        ok: true,
        data: {
          asset: { ...remoteAsset(), status: "PENDING", downloadUrl: null },
          upload: {
            url: "https://storage.example/upload",
            method: "PUT",
            headers: { "Content-Type": "image/png" },
            expiresAt: "2026-08-11T15:05:00.000Z",
          },
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          ...remoteAsset(),
          status: "PROCESSING" as const,
          downloadUrl: null,
          thumbnailUrl: null,
        },
      });
    const file = new File([new Uint8Array([1, 2, 3])], "pixel.png", {
      type: "image/png",
    });

    const response = await uploadWorkspaceAsset({
      workspaceId: "workspace-1",
      folderId: "folder-default-assets",
      type: "image",
      name: "Pixel",
      file,
      width: 1,
      height: 1,
    });

    expect(apiPost).toHaveBeenNthCalledWith(1, "/assets/uploads", {
      workspaceId: "workspace-1",
      folderId: "folder-default-assets",
      type: "image",
      name: "Pixel",
      originalFilename: "pixel.png",
      mimeType: "image/png",
      size: 3,
      width: 1,
      height: 1,
    });
    expect(uploadFetch).toHaveBeenCalledWith(
      "https://storage.example/upload",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: file,
        signal: expect.any(AbortSignal),
      }),
    );
    expect(apiPost).toHaveBeenNthCalledWith(2, "/assets/asset-1/complete");
    expect(response).toMatchObject({
      ok: true,
      data: {
        id: "asset-1",
        source: "remote",
        status: "PROCESSING",
        src: "",
      },
    });
  });

  it("removes the pending record when object storage rejects the PUT", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403 }),
    );
    apiPost.mockResolvedValue({
      ok: true,
      data: {
        asset: { ...remoteAsset(), status: "PENDING", downloadUrl: null },
        upload: {
          url: "https://storage.example/upload",
          method: "PUT",
          headers: { "Content-Type": "image/png" },
          expiresAt: "2026-08-11T15:05:00.000Z",
        },
      },
    });

    const response = await uploadWorkspaceAsset({
      workspaceId: "workspace-1",
      folderId: "folder-default-assets",
      type: "image",
      name: "Pixel",
      file: new File([new Uint8Array([1])], "pixel.png", {
        type: "image/png",
      }),
    });

    expect(response).toMatchObject({ ok: false, status: 403 });
    expect(apiDelete).toHaveBeenCalledWith("/assets/asset-1");
  });
});

function remoteAsset() {
  return {
    id: "asset-1",
    workspaceId: "workspace-1",
    folderId: "folder-default-assets",
    type: "image" as const,
    name: "Pixel",
    originalFilename: "pixel.png",
    mimeType: "image/png",
    sourceMimeType: "image/png",
    detectedMimeType: "image/png",
    size: 3,
    sourceSize: 3,
    storageBytes: 3,
    width: 1,
    height: 1,
    status: "READY" as const,
    downloadUrl: "https://storage.example/download",
    downloadExpiresAt: "2026-08-12T03:00:00.000Z",
    thumbnailUrl: "https://storage.example/thumbnail",
    processingError: null,
    createdAt: "2026-08-11T15:00:00.000Z",
    updatedAt: "2026-08-11T15:00:00.000Z",
  };
}
