import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryAsset } from "../types/asset.types";
import {
  cacheWorkspaceAssets,
  loadCachedWorkspaceAssets,
} from "./assetOfflineCache";
import { indexedDbAssetStorage } from "./assetStorage/indexedDbAssetStorage";

describe("asset offline cache", () => {
  beforeEach(async () => {
    await indexedDbAssetStorage.clearAssetStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("migrates persisted remote metadata into a scoped cache", async () => {
    const current = remoteAsset("asset-current", "workspace-current");
    const other = remoteAsset("asset-other", "workspace-other");

    const result = await loadCachedWorkspaceAssets({
      scope: "user:workspace-current",
      workspaceId: "workspace-current",
      legacyAssets: [current, other],
    });

    expect(result).toEqual([current]);
    await expect(
      indexedDbAssetStorage.getWorkspaceAssets("user:workspace-current"),
    ).resolves.toEqual([current]);
  });

  it("downloads a signed image once and reuses its versioned blob", async () => {
    const asset = remoteAsset("asset-1", "workspace-1");
    const blob = new Blob([new Uint8Array([1, 2, 3])], {
      type: "image/png",
    });
    const download = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(blob),
    });
    vi.stubGlobal("fetch", download);

    await cacheWorkspaceAssets("user:workspace-1", [asset]);
    await cacheWorkspaceAssets("user:workspace-1", [asset]);

    expect(download).toHaveBeenCalledTimes(1);
    await expect(
      indexedDbAssetStorage.getAssetBlobRecord(asset.id),
    ).resolves.toMatchObject({ version: asset.updatedAt });
  });
});

function remoteAsset(id: string, workspaceId: string): LibraryAsset {
  return {
    id,
    workspaceId,
    folderId: "folder-default-assets",
    type: "image",
    name: "Offline",
    src: "https://storage.example/signed",
    mimeType: "image/png",
    size: 3,
    source: "remote",
    createdAt: "2026-08-11T12:00:00.000Z",
    updatedAt: "2026-08-11T12:00:00.000Z",
  };
}
