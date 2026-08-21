import type { LibraryAsset } from "../../types/asset.types";

export interface StoredAssetBlob {
  assetId: string;
  blob: Blob;
  updatedAt: string;
  version?: string;
}

export interface CachedWorkspaceAssets {
  scope: string;
  assets: LibraryAsset[];
  updatedAt: string;
}

export interface AssetBlobStorage {
  saveAssetBlob: (
    assetId: string,
    blob: Blob,
    version?: string,
  ) => Promise<void>;
  getAssetBlob: (assetId: string) => Promise<Blob | null>;
  getAssetBlobRecord: (assetId: string) => Promise<StoredAssetBlob | null>;
  deleteAssetBlob: (assetId: string) => Promise<void>;
  clearAssetStorage: () => Promise<void>;
  saveWorkspaceAssets: (scope: string, assets: LibraryAsset[]) => Promise<void>;
  getWorkspaceAssets: (scope: string) => Promise<LibraryAsset[]>;
  removeWorkspaceAsset: (scope: string, assetId: string) => Promise<void>;
}
