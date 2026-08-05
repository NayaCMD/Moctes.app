export type AssetCategory = "stickers" | "images" | "post-its" | "tapes";

export type AssetType = "image" | "sticker" | "post-it" | "tape";

export type AssetSource = "built-in" | "imported";

export type AssetTypeFilter = "all" | AssetType;

export type AssetSortMode = "recent" | "oldest" | "name-asc" | "name-desc" | "type";

export type AssetImportStatus = "idle" | "validating" | "importing" | "success" | "error";

export type AssetLibraryErrorCode =
  | "FOLDER_LIMIT_REACHED"
  | "ASSET_LIMIT_REACHED"
  | "INVALID_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "FOLDER_NOT_FOUND"
  | "ASSET_NOT_FOUND"
  | "STORAGE_ERROR"
  | "INVALID_NAME";

export interface AssetLibraryError {
  code: AssetLibraryErrorCode;
  message: string;
}

export interface AssetFolder {
  id: string;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryAsset {
  id: string;
  folderId: string;
  type: AssetType;
  name: string;
  src: string;
  mimeType: string;
  size: number;
  source: AssetSource;
  width?: number;
  height?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetReference {
  assetId: string;
  src: string;
  alt: string;
}
