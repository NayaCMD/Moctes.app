import { beforeEach, describe, expect, it } from "vitest";
import type { LibraryAsset } from "../../types/asset.types";
import { indexedDbAssetStorage } from "./indexedDbAssetStorage";

describe("indexedDbAssetStorage", () => {
  beforeEach(async () => {
    await indexedDbAssetStorage.clearAssetStorage();
  });

  it("stores blobs with a server version for offline rendering", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], {
      type: "image/png",
    });

    await indexedDbAssetStorage.saveAssetBlob(
      "asset-1",
      blob,
      "2026-08-11T12:00:00.000Z",
    );

    await expect(
      indexedDbAssetStorage.getAssetBlobRecord("asset-1"),
    ).resolves.toMatchObject({
      assetId: "asset-1",
      version: "2026-08-11T12:00:00.000Z",
      blob,
    });
  });

  it("isolates cached metadata by user and workspace scope", async () => {
    const asset = remoteAsset();
    await indexedDbAssetStorage.saveWorkspaceAssets("user-a:workspace-a", [
      asset,
    ]);

    await expect(
      indexedDbAssetStorage.getWorkspaceAssets("user-a:workspace-a"),
    ).resolves.toEqual([asset]);
    await expect(
      indexedDbAssetStorage.getWorkspaceAssets("user-b:workspace-a"),
    ).resolves.toEqual([]);
  });

  it("removes an asset from both metadata and blob caches", async () => {
    await indexedDbAssetStorage.saveWorkspaceAssets("scope", [remoteAsset()]);
    await indexedDbAssetStorage.saveAssetBlob(
      "asset-1",
      new Blob(["image"], { type: "image/png" }),
    );

    await indexedDbAssetStorage.removeWorkspaceAsset("scope", "asset-1");
    await indexedDbAssetStorage.deleteAssetBlob("asset-1");

    await expect(
      indexedDbAssetStorage.getWorkspaceAssets("scope"),
    ).resolves.toEqual([]);
    await expect(
      indexedDbAssetStorage.getAssetBlob("asset-1"),
    ).resolves.toBeNull();
  });
});

function remoteAsset(): LibraryAsset {
  return {
    id: "asset-1",
    workspaceId: "workspace-a",
    folderId: "folder-default-assets",
    type: "image",
    name: "Offline image",
    src: "https://storage.example/signed",
    mimeType: "image/png",
    size: 3,
    source: "remote",
    createdAt: "2026-08-11T12:00:00.000Z",
    updatedAt: "2026-08-11T12:00:00.000Z",
  };
}
