import { sidebarAssets } from "./assetCatalog";
import type { AssetFolder, LibraryAsset } from "../types/asset.types";
import { categoryToAssetType, DEFAULT_ASSET_FOLDER_ID } from "../utils/assetLibrary.utils";

const createdAt = "2026-07-21T00:00:00.000Z";

export const defaultAssetFolders: AssetFolder[] = [
  {
    id: DEFAULT_ASSET_FOLDER_ID,
    name: "Meus Assets",
    order: 1,
    createdAt,
    updatedAt: createdAt,
  },
];

export const defaultLibraryAssets: LibraryAsset[] = sidebarAssets.map((asset) => ({
  id: asset.id,
  folderId: DEFAULT_ASSET_FOLDER_ID,
  type: categoryToAssetType(asset.category),
  name: asset.label,
  src: asset.src,
  mimeType: asset.src.endsWith(".svg")
    ? "image/svg+xml"
    : asset.src.endsWith(".jpg")
      ? "image/jpeg"
      : "image/png",
  size: 0,
  source: "built-in",
  createdAt,
  updatedAt: createdAt,
  width: undefined,
  height: undefined,
}));
