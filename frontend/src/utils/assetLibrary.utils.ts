import type {
  AssetCategory,
  AssetLibraryError,
  AssetType,
  AssetTypeFilter,
  LibraryAsset,
} from "../types/asset.types";
import type { SidebarAsset } from "../types/document.types";
import type { MoctesDocument } from "../types/document.types";

export const MAX_ASSET_FOLDERS = 5;
export const MAX_ASSETS_PER_FOLDER = 15;
export const MAX_ASSET_FILE_SIZE = 5 * 1024 * 1024;
export const DEFAULT_ASSET_FOLDER_ID = "folder-default-assets";
export const IMPORTED_ASSET_SRC_PREFIX = "asset://";

export const allowedAssetMimeTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
] as const;
const allowedExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"];

export function assetTypeToCategory(type: AssetType): AssetCategory {
  switch (type) {
    case "sticker":
      return "stickers";
    case "image":
      return "images";
    case "post-it":
      return "post-its";
    case "tape":
      return "tapes";
  }
}

export function categoryToAssetType(category: AssetCategory): AssetType {
  switch (category) {
    case "stickers":
      return "sticker";
    case "images":
      return "image";
    case "post-its":
      return "post-it";
    case "tapes":
      return "tape";
  }
}

export function libraryAssetToSidebarAsset(asset: LibraryAsset): SidebarAsset {
  return {
    id: asset.id,
    category: assetTypeToCategory(asset.type),
    type: asset.type,
    label: asset.name,
    src:
      asset.source === "built-in"
        ? asset.src
        : `${IMPORTED_ASSET_SRC_PREFIX}${asset.id}`,
    source: asset.source,
    mimeType: asset.mimeType,
    size: asset.size,
    width: asset.width,
    height: asset.height,
  };
}

export function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

export function filterLibraryAssets(options: {
  assets: LibraryAsset[];
  folderId: string | null;
  query: string;
  typeFilter: AssetTypeFilter;
}): LibraryAsset[] {
  const normalizedQuery = normalizeSearchQuery(options.query);
  return options.assets.filter((asset) => {
    const folderMatches =
      !options.folderId || asset.folderId === options.folderId;
    const typeMatches =
      options.typeFilter === "all" || asset.type === options.typeFilter;
    const queryMatches =
      normalizedQuery.length === 0 ||
      asset.name.toLowerCase().includes(normalizedQuery) ||
      asset.type.includes(normalizedQuery);
    return folderMatches && typeMatches && queryMatches;
  });
}

export function validateAssetFile(file: File): AssetLibraryError | null {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (
    !allowedAssetMimeTypes.includes(
      file.type as (typeof allowedAssetMimeTypes)[number],
    ) ||
    !allowedExtensions.includes(extension)
  ) {
    return {
      code: "INVALID_FILE_TYPE",
      message: "Use PNG, JPEG, WEBP, GIF ou SVG seguro.",
    };
  }

  if (file.size > MAX_ASSET_FILE_SIZE) {
    return {
      code: "FILE_TOO_LARGE",
      message: "O arquivo precisa ter no maximo 5 MB.",
    };
  }

  return null;
}

export function findAssetReferences(
  documents: MoctesDocument[],
  assetId: string,
): Array<{
  documentId: string;
  pageId: string;
  elementId: string;
}> {
  return documents.flatMap((document) =>
    document.pages.flatMap((page) =>
      page.elements
        .filter(
          (element) =>
            "assetId" in element.content && element.content.assetId === assetId,
        )
        .map((element) => ({
          documentId: document.id,
          pageId: page.id,
          elementId: element.id,
        })),
    ),
  );
}
