export interface StoredAssetBlob {
  assetId: string;
  blob: Blob;
  updatedAt: string;
}

export interface AssetBlobStorage {
  saveAssetBlob: (assetId: string, blob: Blob) => Promise<void>;
  getAssetBlob: (assetId: string) => Promise<Blob | null>;
  deleteAssetBlob: (assetId: string) => Promise<void>;
  clearAssetStorage: () => Promise<void>;
}
