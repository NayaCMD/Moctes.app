import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  defaultAssetFolders,
  defaultLibraryAssets,
} from "../data/initialAssetLibrary";
import type {
  AssetFolder,
  AssetImportStatus,
  AssetLibraryError,
  AssetSortMode,
  AssetTypeFilter,
  LibraryAsset,
} from "../types/asset.types";
import {
  DEFAULT_ASSET_FOLDER_ID,
  filterLibraryAssets,
  MAX_ASSET_FOLDERS,
  MAX_ASSETS_PER_FOLDER,
} from "../utils/assetLibrary.utils";
import { createId, timestamp } from "../utils/document.utils";

export type AssetLibraryResult<T = void> =
  { ok: true; value: T } | { ok: false; error: AssetLibraryError };

interface AssetLibraryStoreState {
  folders: AssetFolder[];
  assets: LibraryAsset[];
  activeFolderId: string;
  selectedAssetId: string | null;
  searchQuery: string;
  activeTypeFilter: AssetTypeFilter;
  sortMode: AssetSortMode;
  importStatus: AssetImportStatus;
  importError: AssetLibraryError | null;
  feedbackMessage: string | null;
  createFolder: (name?: string) => AssetLibraryResult<string>;
  renameFolder: (folderId: string, name: string) => AssetLibraryResult;
  deleteFolder: (
    folderId: string,
    destinationFolderId?: string,
  ) => AssetLibraryResult<string[]>;
  reorderFolders: (folderIds: string[]) => void;
  setActiveFolder: (folderId: string) => AssetLibraryResult;
  addAsset: (asset: LibraryAsset) => AssetLibraryResult<string>;
  replaceAsset: (
    assetId: string,
    replacement: LibraryAsset,
  ) => AssetLibraryResult<string>;
  replaceRemoteAssets: (assets: LibraryAsset[]) => void;
  upsertRemoteAsset: (asset: LibraryAsset) => void;
  updateAsset: (
    assetId: string,
    updates: Partial<LibraryAsset>,
  ) => AssetLibraryResult;
  deleteAsset: (assetId: string) => AssetLibraryResult<LibraryAsset>;
  moveAssetToFolder: (assetId: string, folderId: string) => AssetLibraryResult;
  setSelectedAsset: (assetId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setTypeFilter: (filter: AssetTypeFilter) => void;
  setSortMode: (sortMode: AssetSortMode) => void;
  setImportStatus: (
    status: AssetImportStatus,
    error?: AssetLibraryError | null,
  ) => void;
  setFeedbackMessage: (message: string | null) => void;
  restoreDefaultAssets: () => void;
  getFilteredAssets: () => LibraryAsset[];
}

type PersistedAssetLibraryState = Pick<
  AssetLibraryStoreState,
  | "folders"
  | "assets"
  | "activeFolderId"
  | "selectedAssetId"
  | "searchQuery"
  | "activeTypeFilter"
>;

const fallbackState: PersistedAssetLibraryState = {
  folders: defaultAssetFolders,
  assets: defaultLibraryAssets,
  activeFolderId: DEFAULT_ASSET_FOLDER_ID,
  selectedAssetId: null,
  searchQuery: "",
  activeTypeFilter: "all",
};

export const useAssetLibraryStore = create<AssetLibraryStoreState>()(
  persist<AssetLibraryStoreState, [], [], PersistedAssetLibraryState>(
    (set, get) => ({
      ...fallbackState,
      sortMode: "recent",
      importStatus: "idle",
      importError: null,
      feedbackMessage: null,

      createFolder: (name) => {
        const state = get();
        if (state.folders.length >= MAX_ASSET_FOLDERS) {
          return failure(
            "FOLDER_LIMIT_REACHED",
            "Limite de 5 pastas atingido.",
          );
        }

        const trimmedName = (
          name?.trim() || `Pasta ${state.folders.length + 1}`
        ).slice(0, 40);
        if (!trimmedName) {
          return failure("INVALID_NAME", "Informe um nome para a pasta.");
        }

        const createdAt = timestamp();
        const folder: AssetFolder = {
          id: createId("asset-folder"),
          name: trimmedName,
          order: state.folders.length + 1,
          createdAt,
          updatedAt: createdAt,
        };
        set({
          folders: [...state.folders, folder],
          activeFolderId: folder.id,
          feedbackMessage: "Pasta criada.",
        });
        return success(folder.id);
      },

      renameFolder: (folderId, name) => {
        const trimmedName = name.trim().slice(0, 40);
        if (!trimmedName) {
          return failure("INVALID_NAME", "Informe um nome para a pasta.");
        }
        if (!get().folders.some((folder) => folder.id === folderId)) {
          return failure("FOLDER_NOT_FOUND", "Pasta nao encontrada.");
        }

        set((state) => ({
          folders: state.folders.map((folder) =>
            folder.id === folderId
              ? { ...folder, name: trimmedName, updatedAt: timestamp() }
              : folder,
          ),
          feedbackMessage: "Pasta renomeada.",
        }));
        return success(undefined);
      },

      deleteFolder: (folderId, destinationFolderId) => {
        const state = get();
        const folder = state.folders.find((item) => item.id === folderId);
        if (!folder) {
          return failure("FOLDER_NOT_FOUND", "Pasta nao encontrada.");
        }
        if (state.folders.length <= 1) {
          return failure(
            "FOLDER_LIMIT_REACHED",
            "Crie outra pasta antes de excluir esta.",
          );
        }

        const folderAssets = state.assets.filter(
          (asset) => asset.folderId === folderId,
        );
        const removedImportedAssetIds = folderAssets
          .filter((asset) => asset.source === "imported")
          .map((asset) => asset.id);
        const destination = destinationFolderId
          ? state.folders.find((item) => item.id === destinationFolderId)
          : undefined;

        if (destinationFolderId && !destination) {
          return failure(
            "FOLDER_NOT_FOUND",
            "Pasta de destino nao encontrada.",
          );
        }
        if (destination) {
          const destinationCount = state.assets.filter(
            (asset) => asset.folderId === destination.id,
          ).length;
          if (destinationCount + folderAssets.length > MAX_ASSETS_PER_FOLDER) {
            return failure(
              "ASSET_LIMIT_REACHED",
              "A pasta de destino atingiria o limite de 15 itens.",
            );
          }
        }

        const folders = normalizeFolderOrder(
          state.folders.filter((item) => item.id !== folderId),
        );
        const nextActiveFolderId =
          state.activeFolderId === folderId
            ? folders[0].id
            : state.activeFolderId;
        set({
          folders,
          assets: destination
            ? state.assets.map((asset) =>
                asset.folderId === folderId
                  ? {
                      ...asset,
                      folderId: destination.id,
                      updatedAt: timestamp(),
                    }
                  : asset,
              )
            : state.assets.filter((asset) => asset.folderId !== folderId),
          activeFolderId: nextActiveFolderId,
          selectedAssetId:
            state.selectedAssetId &&
            folderAssets.some((asset) => asset.id === state.selectedAssetId)
              ? null
              : state.selectedAssetId,
          feedbackMessage: destination
            ? "Pasta excluida e assets movidos."
            : "Pasta e assets excluidos.",
        });
        return success(removedImportedAssetIds);
      },

      reorderFolders: (folderIds) =>
        set((state) => {
          const orderById = new Map(
            folderIds.map((folderId, index) => [folderId, index + 1]),
          );
          return {
            folders: normalizeFolderOrder(
              state.folders.map((folder) => ({
                ...folder,
                order: orderById.get(folder.id) ?? folder.order,
              })),
            ),
          };
        }),

      setActiveFolder: (folderId) => {
        if (!get().folders.some((folder) => folder.id === folderId)) {
          return failure("FOLDER_NOT_FOUND", "Pasta nao encontrada.");
        }
        set({ activeFolderId: folderId, selectedAssetId: null });
        return success(undefined);
      },

      addAsset: (asset) => {
        const state = get();
        if (!state.folders.some((folder) => folder.id === asset.folderId)) {
          return failure("FOLDER_NOT_FOUND", "Pasta nao encontrada.");
        }
        if (
          state.assets.filter((item) => item.folderId === asset.folderId)
            .length >= MAX_ASSETS_PER_FOLDER
        ) {
          return failure(
            "ASSET_LIMIT_REACHED",
            "Esta pasta ja possui 15 itens.",
          );
        }

        set({
          assets: [...state.assets, asset],
          selectedAssetId: asset.id,
          activeFolderId: asset.folderId,
          importStatus: "success",
          importError: null,
          feedbackMessage: "Asset importado.",
        });
        return success(asset.id);
      },

      replaceAsset: (assetId, replacement) => {
        const current = get().assets.find((asset) => asset.id === assetId);
        if (!current) {
          return failure("ASSET_NOT_FOUND", "Asset nao encontrado.");
        }
        const next = { ...replacement, folderId: current.folderId };
        set((state) => ({
          assets: state.assets
            .filter(
              (asset) =>
                asset.id !== replacement.id || asset.id === assetId,
            )
            .map((asset) => (asset.id === assetId ? next : asset)),
          selectedAssetId:
            state.selectedAssetId === assetId
              ? replacement.id
              : state.selectedAssetId,
          feedbackMessage: "Asset local migrado para o espaço.",
        }));
        return success(replacement.id);
      },

      replaceRemoteAssets: (remoteAssets) =>
        set((state) => {
          const folderIds = new Set(state.folders.map((folder) => folder.id));
          const normalizedRemoteAssets = remoteAssets.map((asset) => ({
            ...asset,
            folderId: folderIds.has(asset.folderId)
              ? asset.folderId
              : DEFAULT_ASSET_FOLDER_ID,
          }));
          return {
            assets: [
              ...state.assets.filter((asset) => asset.source !== "remote"),
              ...normalizedRemoteAssets,
            ],
            selectedAssetId: normalizedRemoteAssets.some(
              (asset) => asset.id === state.selectedAssetId,
            )
              ? state.selectedAssetId
              : state.assets.some(
                    (asset) =>
                      asset.source !== "remote" &&
                      asset.id === state.selectedAssetId,
                  )
                ? state.selectedAssetId
                : null,
          };
        }),

      upsertRemoteAsset: (asset) =>
        set((state) => {
          const folderIds = new Set(state.folders.map((folder) => folder.id));
          const normalized = {
            ...asset,
            folderId: folderIds.has(asset.folderId)
              ? asset.folderId
              : DEFAULT_ASSET_FOLDER_ID,
          };
          const exists = state.assets.some((item) => item.id === asset.id);
          return {
            assets: exists
              ? state.assets.map((item) =>
                  item.id === asset.id ? normalized : item,
                )
              : [...state.assets, normalized],
          };
        }),

      updateAsset: (assetId, updates) => {
        if (!get().assets.some((asset) => asset.id === assetId)) {
          return failure("ASSET_NOT_FOUND", "Asset nao encontrado.");
        }
        set((state) => ({
          assets: state.assets.map((asset) =>
            asset.id === assetId
              ? { ...asset, ...updates, id: asset.id, updatedAt: timestamp() }
              : asset,
          ),
          feedbackMessage: "Asset atualizado.",
        }));
        return success(undefined);
      },

      deleteAsset: (assetId) => {
        const asset = get().assets.find((item) => item.id === assetId);
        if (!asset) {
          return failure("ASSET_NOT_FOUND", "Asset nao encontrado.");
        }
        set((state) => ({
          assets: state.assets.filter((item) => item.id !== assetId),
          selectedAssetId:
            state.selectedAssetId === assetId ? null : state.selectedAssetId,
          feedbackMessage: "Asset excluido.",
        }));
        return success(asset);
      },

      moveAssetToFolder: (assetId, folderId) => {
        const state = get();
        if (!state.assets.some((asset) => asset.id === assetId)) {
          return failure("ASSET_NOT_FOUND", "Asset nao encontrado.");
        }
        if (!state.folders.some((folder) => folder.id === folderId)) {
          return failure("FOLDER_NOT_FOUND", "Pasta nao encontrada.");
        }
        if (
          state.assets.filter((asset) => asset.folderId === folderId).length >=
          MAX_ASSETS_PER_FOLDER
        ) {
          return failure(
            "ASSET_LIMIT_REACHED",
            "Esta pasta ja possui 15 itens.",
          );
        }
        set({
          assets: state.assets.map((asset) =>
            asset.id === assetId
              ? { ...asset, folderId, updatedAt: timestamp() }
              : asset,
          ),
          feedbackMessage: "Asset movido.",
        });
        return success(undefined);
      },

      setSelectedAsset: (selectedAssetId) => set({ selectedAssetId }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setTypeFilter: (activeTypeFilter) => set({ activeTypeFilter }),
      setSortMode: (sortMode) => set({ sortMode }),
      setImportStatus: (importStatus, importError = null) =>
        set({ importStatus, importError }),
      setFeedbackMessage: (feedbackMessage) => set({ feedbackMessage }),
      restoreDefaultAssets: () =>
        set({
          ...fallbackState,
          sortMode: "recent",
          importStatus: "idle",
          importError: null,
          feedbackMessage: "Assets padrao restaurados.",
        }),
      getFilteredAssets: () => {
        const state = get();
        return sortAssets(
          filterLibraryAssets({
            assets: state.assets,
            folderId: state.activeFolderId,
            query: state.searchQuery,
            typeFilter: state.activeTypeFilter,
          }),
          state.sortMode,
        );
      },
    }),
    {
      name: "moctes-asset-library-v1",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted) => sanitizePersistedAssetLibraryState(persisted),
      partialize: (state) => ({
        folders: state.folders,
        assets: state.assets.filter((asset) => asset.source !== "remote"),
        activeFolderId: state.activeFolderId,
        selectedAssetId: state.selectedAssetId,
        searchQuery: state.searchQuery,
        activeTypeFilter: state.activeTypeFilter,
      }),
    },
  ),
);

function success<T>(value: T): AssetLibraryResult<T> {
  return { ok: true, value };
}

function failure(
  code: AssetLibraryError["code"],
  message: string,
): AssetLibraryResult<never> {
  return { ok: false, error: { code, message } };
}

function normalizeFolderOrder(folders: AssetFolder[]): AssetFolder[] {
  return [...folders]
    .sort((first, second) => first.order - second.order)
    .map((folder, index) => ({ ...folder, order: index + 1 }));
}

function sortAssets(
  assets: LibraryAsset[],
  sortMode: AssetSortMode,
): LibraryAsset[] {
  return [...assets].sort((first, second) => {
    switch (sortMode) {
      case "oldest":
        return first.createdAt.localeCompare(second.createdAt);
      case "name-asc":
        return first.name.localeCompare(second.name);
      case "name-desc":
        return second.name.localeCompare(first.name);
      case "type":
        return (
          first.type.localeCompare(second.type) ||
          first.name.localeCompare(second.name)
        );
      case "recent":
        return second.createdAt.localeCompare(first.createdAt);
    }
  });
}

function sanitizePersistedAssetLibraryState(
  value: unknown,
): PersistedAssetLibraryState {
  if (!isPersistedAssetLibraryState(value)) {
    return fallbackState;
  }

  const folders =
    value.folders.length > 0
      ? normalizeFolderOrder(value.folders).slice(0, MAX_ASSET_FOLDERS)
      : defaultAssetFolders;
  const folderIds = new Set(folders.map((folder) => folder.id));
  const assets = value.assets
    .filter((asset) => folderIds.has(asset.folderId))
    .filter(
      (asset, _index, all) =>
        all.filter((item) => item.folderId === asset.folderId).indexOf(asset) <
        MAX_ASSETS_PER_FOLDER,
    );
  const activeFolderId = folderIds.has(value.activeFolderId)
    ? value.activeFolderId
    : folders[0].id;

  return {
    folders,
    assets: assets.length > 0 ? assets : defaultLibraryAssets,
    activeFolderId,
    selectedAssetId: assets.some((asset) => asset.id === value.selectedAssetId)
      ? value.selectedAssetId
      : null,
    searchQuery: value.searchQuery ?? "",
    activeTypeFilter: value.activeTypeFilter ?? "all",
  };
}

function isPersistedAssetLibraryState(
  value: unknown,
): value is PersistedAssetLibraryState {
  return (
    typeof value === "object" &&
    value !== null &&
    "folders" in value &&
    "assets" in value &&
    Array.isArray((value as { folders: unknown }).folders) &&
    Array.isArray((value as { assets: unknown }).assets)
  );
}
