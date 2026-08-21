import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAssetLibraryStore } from "../stores/useAssetLibraryStore";
import { useDocumentStore } from "../stores/useDocumentStore";
import { resetStores } from "../test/helpers/resetStores";
import type { LibraryAsset } from "../types/asset.types";
import {
  migrateLegacyImportedAssets,
  reconcilePendingAssetMigrations,
} from "./assetMigration";
import * as assetPersistence from "./assetPersistence";
import { indexedDbAssetStorage } from "./assetStorage/indexedDbAssetStorage";

vi.mock("./assetPersistence", () => ({
  uploadWorkspaceAsset: vi.fn(),
  deleteWorkspaceAsset: vi.fn(),
}));

const uploadWorkspaceAsset = vi.mocked(assetPersistence.uploadWorkspaceAsset);

describe("legacy asset migration", () => {
  beforeEach(async () => {
    resetStores();
    vi.clearAllMocks();
    localStorage.clear();
    await indexedDbAssetStorage.clearAssetStorage();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("keeps the local blob until the asynchronous remote asset is ready", async () => {
    const legacy = importedAsset();
    expect(useAssetLibraryStore.getState().addAsset(legacy).ok).toBe(true);
    await indexedDbAssetStorage.saveAssetBlob(
      legacy.id,
      new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
    );
    uploadWorkspaceAsset.mockResolvedValue({
      ok: true,
      data: remoteAsset("PROCESSING"),
    });

    await expect(
      migrateLegacyImportedAssets({
        scope: "user-1:workspace-1",
        workspaceId: "workspace-1",
      }),
    ).resolves.toEqual({ migrated: 0, skipped: 1, failed: 0 });
    await expect(
      indexedDbAssetStorage.getAssetBlob(legacy.id),
    ).resolves.not.toBeNull();
    expect(
      useAssetLibraryStore
        .getState()
        .assets.some((asset) => asset.id === legacy.id),
    ).toBe(true);

    useAssetLibraryStore.getState().updateAsset("remote-asset", {
      status: "READY",
      src: "https://storage.example/signed",
    });
    await expect(
      reconcilePendingAssetMigrations({
        scope: "user-1:workspace-1",
        workspaceId: "workspace-1",
      }),
    ).resolves.toBe(1);
    await expect(
      indexedDbAssetStorage.getAssetBlob(legacy.id),
    ).resolves.toBeNull();
    expect(
      useAssetLibraryStore
        .getState()
        .assets.some((asset) => asset.id === legacy.id),
    ).toBe(false);
  });

  it("uploads a local blob and replaces its document references", async () => {
    const legacy = importedAsset();
    expect(useAssetLibraryStore.getState().addAsset(legacy).ok).toBe(true);
    await indexedDbAssetStorage.saveAssetBlob(
      legacy.id,
      new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
    );
    const document = structuredClone(useDocumentStore.getState().documents[0]);
    document.pages[0].elements.push({
      id: "legacy-element",
      type: "image",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      zIndex: 100,
      locked: false,
      hidden: false,
      content: {
        kind: "image",
        assetId: legacy.id,
        src: `asset://${legacy.id}`,
        alt: legacy.name,
      },
      style: {},
    });
    useDocumentStore.getState().applyDocumentsSnapshot([document]);
    uploadWorkspaceAsset.mockResolvedValue({
      ok: true,
      data: remoteAsset(),
    });

    const result = await migrateLegacyImportedAssets({
      scope: "user-1:workspace-1",
      workspaceId: "workspace-1",
    });

    expect(result).toEqual({ migrated: 1, skipped: 0, failed: 0 });
    expect(uploadWorkspaceAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        cacheScope: "user-1:workspace-1",
      }),
    );
    expect(
      useAssetLibraryStore
        .getState()
        .assets.some((asset) => asset.id === "remote-asset"),
    ).toBe(true);
    const content = useDocumentStore
      .getState()
      .documents[0].pages[0].elements.find(
        (element) => element.id === "legacy-element",
      )?.content;
    expect(content).toMatchObject({
      assetId: "remote-asset",
      src: "asset://remote-asset",
    });
    await expect(
      indexedDbAssetStorage.getAssetBlob(legacy.id),
    ).resolves.toBeNull();
  });
});

function importedAsset(): LibraryAsset {
  return {
    id: "legacy-asset",
    folderId: "folder-default-assets",
    type: "image",
    name: "Legacy image",
    src: "asset://legacy-asset",
    mimeType: "image/png",
    size: 3,
    source: "imported",
    createdAt: "2026-08-11T12:00:00.000Z",
    updatedAt: "2026-08-11T12:00:00.000Z",
  };
}

function remoteAsset(
  status: LibraryAsset["status"] = "READY",
): LibraryAsset {
  return {
    ...importedAsset(),
    id: "remote-asset",
    workspaceId: "workspace-1",
    src: status === "READY" ? "https://storage.example/signed" : "",
    source: "remote",
    status,
  };
}
