import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PHONE_EDITOR_QUERY, useIsCompactTouchEditor } from "../../hooks/useResponsiveEditor";
import { useWorkspaceCapabilities } from "../../hooks/useWorkspaceCapabilities";
import { useAppStore } from "../../stores/useAppStore";
import { useAssetLibraryStore } from "../../stores/useAssetLibraryStore";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type { AssetTypeFilter, LibraryAsset } from "../../types/asset.types";
import type { SidebarAsset } from "../../types/document.types";
import {
  findAssetReferences,
  MAX_ASSETS_PER_FOLDER,
  MAX_ASSET_FOLDERS,
} from "../../utils/assetLibrary.utils";
import { getEditableActivePage } from "../../utils/document.utils";
import { createElementFromAsset } from "../../utils/element.utils";
import { placeElementForInsertion } from "../../utils/insertion.utils";
import { indexedDbAssetStorage } from "../../services/assetStorage/indexedDbAssetStorage";
import {
  deleteWorkspaceAsset,
  loadWorkspaceAssetUsage,
  type WorkspaceAssetUsage,
} from "../../services/assetPersistence";
import { useAuthStore } from "../../stores/useAuthStore";
import { PaperSettings } from "../editor/PaperSettings";
import { PropertySection } from "../editor/PropertyControls";
import { DevelopmentSettings } from "../editor/DevelopmentSettings";
import { SelectedElementProperties } from "../editor/SelectedElementProperties";
import { ThemeSelector } from "../theme/ThemeSelector";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { AssetImportModal } from "./AssetImportModal";
import { AssetSection } from "./AssetSection";

const filters: Array<{ value: AssetTypeFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "sticker", label: "Stickers" },
  { value: "image", label: "Imagens" },
  { value: "post-it", label: "Post-its" },
  { value: "tape", label: "Tapes" },
];

export function Sidebar() {
  const isCompactTouchEditor = useIsCompactTouchEditor();
  const { canEdit, canManageMembers } = useWorkspaceCapabilities();
  const previousCompactTouchLayout = useRef(false);
  const manageLibraryButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarVisible = useAppStore((state) => state.sidebarVisible);
  const setSidebarVisible = useAppStore((state) => state.setSidebarVisible);
  const activeSidebarTab = useAppStore((state) => state.activeSidebarTab);
  const setActiveSidebarTab = useAppStore((state) => state.setActiveSidebarTab);
  const documents = useDocumentStore((state) => state.documents);
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const addElement = useDocumentStore((state) => state.addElement);
  const updatePage = useDocumentStore((state) => state.updatePage);
  const cancelAssetDrag = useEditorStore((state) => state.cancelAssetDrag);
  const notebookTransition = useEditorStore(
    (state) => state.notebookTransition,
  );
  const notebookBook = useEditorStore((state) => state.notebookBook);
  const folders = useAssetLibraryStore((state) => state.folders);
  const assets = useAssetLibraryStore((state) => state.assets);
  const activeFolderId = useAssetLibraryStore((state) => state.activeFolderId);
  const selectedAssetId = useAssetLibraryStore(
    (state) => state.selectedAssetId,
  );
  const searchQuery = useAssetLibraryStore((state) => state.searchQuery);
  const activeTypeFilter = useAssetLibraryStore(
    (state) => state.activeTypeFilter,
  );
  const sortMode = useAssetLibraryStore((state) => state.sortMode);
  const feedbackMessage = useAssetLibraryStore(
    (state) => state.feedbackMessage,
  );
  const importError = useAssetLibraryStore((state) => state.importError);
  const createFolder = useAssetLibraryStore((state) => state.createFolder);
  const renameFolder = useAssetLibraryStore((state) => state.renameFolder);
  const deleteFolder = useAssetLibraryStore((state) => state.deleteFolder);
  const setActiveFolder = useAssetLibraryStore(
    (state) => state.setActiveFolder,
  );
  const setSelectedAsset = useAssetLibraryStore(
    (state) => state.setSelectedAsset,
  );
  const setSearchQuery = useAssetLibraryStore((state) => state.setSearchQuery);
  const setTypeFilter = useAssetLibraryStore((state) => state.setTypeFilter);
  const setSortMode = useAssetLibraryStore((state) => state.setSortMode);
  const deleteAsset = useAssetLibraryStore((state) => state.deleteAsset);
  const restoreDefaultAssets = useAssetLibraryStore(
    (state) => state.restoreDefaultAssets,
  );
  const getFilteredAssets = useAssetLibraryStore(
    (state) => state.getFilteredAssets,
  );
  const setFeedbackMessage = useAssetLibraryStore(
    (state) => state.setFeedbackMessage,
  );
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);
  const userId = useAuthStore((state) => state.user?.id);
  const [importOpen, setImportOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [folderPendingDelete, setFolderPendingDelete] = useState<string | null>(
    null,
  );
  const [assetPendingDelete, setAssetPendingDelete] =
    useState<LibraryAsset | null>(null);
  const [assetUsage, setAssetUsage] = useState<WorkspaceAssetUsage | null>(
    null,
  );
  const closeAdvancedLibrary = useCallback(() => {
    setAdvancedOpen(false);
    window.requestAnimationFrame(() => manageLibraryButtonRef.current?.focus());
  }, []);
  const activeFolder =
    folders.find((folder) => folder.id === activeFolderId) ?? folders[0];
  const activeDocument = documents.find(
    (document) => document.id === activeDocumentId,
  );
  const editableActivePage = activeDocument
    ? getEditableActivePage(activeDocument, {
        notebookBook,
        notebookTransition,
      })
    : undefined;
  const visibleAssets = getFilteredAssets();
  const activeFolderCount = assets.filter(
    (asset) => asset.folderId === activeFolder?.id,
  ).length;
  const statusMessage = importError?.message ?? feedbackMessage;
  const canManageRemoteAssets = canEdit;

  useEffect(() => {
    if (isCompactTouchEditor && !previousCompactTouchLayout.current) {
      setSidebarVisible(false);
    }
    previousCompactTouchLayout.current = isCompactTouchEditor;
  }, [isCompactTouchEditor, setSidebarVisible]);

  const sectionTitle = useMemo(
    () => activeFolder?.name ?? "Biblioteca",
    [activeFolder],
  );
  const simpleSections = useMemo(
    () => [
      {
        title: "Stickers",
        assets: assets.filter((asset) => asset.type === "sticker").slice(0, 6),
      },
      {
        title: "Imagens",
        assets: assets.filter((asset) => asset.type === "image").slice(0, 6),
      },
      {
        title: "Post-its",
        assets: assets.filter((asset) => asset.type === "post-it").slice(0, 6),
      },
      {
        title: "Tapes",
        assets: assets.filter((asset) => asset.type === "tape").slice(0, 6),
      },
    ],
    [assets],
  );

  useEffect(() => {
    if (!advancedOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAdvancedLibrary();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [advancedOpen, closeAdvancedLibrary]);

  useEffect(() => {
    if (!advancedOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() =>
      drawerCloseButtonRef.current?.focus(),
    );
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [advancedOpen]);

  useEffect(() => {
    if (!advancedOpen || !activeWorkspaceId) {
      return;
    }
    let active = true;
    void loadWorkspaceAssetUsage(activeWorkspaceId).then((response) => {
      if (active && response.ok) {
        setAssetUsage(response.data);
      }
    });
    return () => {
      active = false;
    };
  }, [activeWorkspaceId, advancedOpen, assets.length]);

  const showAddedFeedback = (assetId: string) => {
    setSelectedAsset(assetId);
    setFeedbackMessage("Asset adicionado à página.");
    if (window.matchMedia?.(PHONE_EDITOR_QUERY).matches) {
      setSidebarVisible(false);
    }
    window.setTimeout(() => setFeedbackMessage(null), 900);
  };

  const addAssetToPage = (asset: SidebarAsset) => {
    if (!canEdit) {
      setFeedbackMessage("Você tem acesso somente leitura a este espaço.");
      return;
    }
    const page = editableActivePage;
    if (!page) {
      return;
    }
    const element = placeElementForInsertion({
      element: createElementFromAsset(asset),
      existingElements: page.elements,
    });
    addElement(page.id, element);
    showAddedFeedback(asset.id);
  };

  const createNewFolder = () => {
    const name = window.prompt(
      "Nome da nova pasta",
      `Pasta ${folders.length + 1}`,
    );
    if (name === null) {
      return;
    }
    const result = createFolder(name);
    if (result.ok === false) {
      setFeedbackMessage(result.error.message);
    }
  };

  const renameActiveFolder = () => {
    if (!activeFolder) {
      return;
    }
    const name = window.prompt("Novo nome da pasta", activeFolder.name);
    if (name === null) {
      return;
    }
    const result = renameFolder(activeFolder.id, name);
    if (result.ok === false) {
      setFeedbackMessage(result.error.message);
    }
  };

  const deleteActiveFolder = () => {
    if (!activeFolder) {
      return;
    }
    setFolderPendingDelete(activeFolder.id);
  };

  const confirmDeleteFolder = () => {
    if (!folderPendingDelete) {
      return;
    }
    const otherFolder = folders.find(
      (folder) => folder.id !== folderPendingDelete,
    );
    const result = deleteFolder(folderPendingDelete, otherFolder?.id);
    if (result.ok === false) {
      setFeedbackMessage(result.error.message);
      setFolderPendingDelete(null);
      return;
    }
    void Promise.all(
      result.value.map((assetId) =>
        indexedDbAssetStorage.deleteAssetBlob(assetId),
      ),
    );
    setFolderPendingDelete(null);
  };

  const removeAssetFromPages = (assetId: string) => {
    documents.forEach((document) => {
      document.pages.forEach((page) => {
        if (
          page.elements.some(
            (element) =>
              "assetId" in element.content &&
              element.content.assetId === assetId,
          )
        ) {
          updatePage(page.id, {
            elements: page.elements.filter(
              (element) =>
                !("assetId" in element.content) ||
                element.content.assetId !== assetId,
            ),
          });
        }
      });
    });
  };

  const deleteLibraryAsset = (asset: LibraryAsset) => {
    setAssetPendingDelete(asset);
  };

  const confirmDeleteLibraryAsset = async () => {
    const asset = assetPendingDelete;
    if (!asset) {
      return;
    }
    if (asset.source === "remote") {
      const response = await deleteWorkspaceAsset(
        asset.id,
        userId && activeWorkspaceId
          ? `${userId}:${activeWorkspaceId}`
          : undefined,
      );
      if (!response.ok) {
        setFeedbackMessage("Não foi possível excluir o asset remoto.");
        setAssetPendingDelete(null);
        return;
      }
    }

    const references = findAssetReferences(documents, asset.id);
    if (references.length > 0) {
      removeAssetFromPages(asset.id);
    }

    const result = deleteAsset(asset.id);
    if (result.ok === false) {
      setFeedbackMessage(result.error.message);
      setAssetPendingDelete(null);
      return;
    }
    if (asset.source === "imported") {
      void indexedDbAssetStorage.deleteAssetBlob(asset.id);
    }
    setAssetPendingDelete(null);
  };

  if (!sidebarVisible) {
    return (
      <aside
        className="asset-sidebar asset-sidebar-collapsed"
        aria-label="Biblioteca recolhida"
      >
        <button
          type="button"
          className="sidebar-toggle"
          aria-label="Mostrar biblioteca de assets"
          data-tooltip="Mostrar painel"
          onClick={() => setSidebarVisible(true)}
        >
          <PanelLeftOpen size={18} />
        </button>
      </aside>
    );
  }

  return (
    <>
      <button
        type="button"
        className="mobile-sidebar-backdrop"
        aria-label="Fechar painel"
        onClick={() => setSidebarVisible(false)}
      />
      <aside
        className="asset-sidebar"
        aria-label="Biblioteca e propriedades"
        data-active-tab={activeSidebarTab}
      >
      <header className="asset-sidebar-header">
        <span>{activeSidebarTab === "library" ? "Biblioteca" : "Propriedades"}</span>
        {canEdit && (
          <button
            ref={manageLibraryButtonRef}
            type="button"
            className="asset-manage-button"
            aria-label="Gerenciar biblioteca"
            data-tooltip="Gerenciar biblioteca"
            onClick={() => setAdvancedOpen(true)}
          >
            <Settings2 size={15} />
          </button>
        )}
        <button
          type="button"
          className="sidebar-toggle"
          aria-label="Recolher biblioteca de assets"
          data-tooltip="Recolher painel"
          onClick={() => {
            cancelAssetDrag();
            setSidebarVisible(false);
          }}
        >
          <PanelLeftClose size={18} />
        </button>
      </header>

      <div className="asset-sidebar-tabs" role="tablist" aria-label="Sidebar">
        <button
          type="button"
          role="tab"
          aria-selected={activeSidebarTab === "library"}
          data-active={activeSidebarTab === "library"}
          onClick={() => setActiveSidebarTab("library")}
        >
          Biblioteca
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSidebarTab === "appearance"}
          data-active={activeSidebarTab === "appearance"}
          onClick={() => setActiveSidebarTab("appearance")}
        >
          Aparência
        </button>
      </div>

      <div className="asset-sidebar-content">
        {activeSidebarTab === "library" ? (
          <div
            className="asset-sidebar-panel"
            role="tabpanel"
            aria-label="Biblioteca"
          >
            <div className="asset-feedback" aria-live="polite">
              {statusMessage ??
                `${activeFolderCount} de ${MAX_ASSETS_PER_FOLDER} itens`}
            </div>
            {simpleSections.map((section) => (
              <AssetSection
                key={section.title}
                title={section.title}
                assets={section.assets}
                selectedAssetId={selectedAssetId}
                onSelect={setSelectedAsset}
                onAdd={canEdit ? addAssetToPage : undefined}
                onAdded={canEdit ? showAddedFeedback : undefined}
                showActions={false}
              />
            ))}
          </div>
        ) : (
          <div
            className="asset-sidebar-panel appearance-sidebar-panel"
            role="tabpanel"
            aria-label="Aparência"
          >
            <header className="inspector-heading">
              <span>Propriedades</span>
              <h2>Aparência</h2>
              <p>Edite o elemento selecionado e a aparência do documento.</p>
            </header>
            {canEdit ? (
              <SelectedElementProperties />
            ) : (
              <div className="asset-feedback">Este documento está em modo somente leitura.</div>
            )}
            <PropertySection title="Interface" description="Tema visual do aplicativo">
              <ThemeSelector />
            </PropertySection>
            {canEdit && <PaperSettings />}
            {import.meta.env.DEV && canManageMembers && <DevelopmentSettings />}
          </div>
        )}
      </div>
      {advancedOpen && canEdit && createPortal(
        <div
          className="asset-library-drawer"
          role="presentation"
          onPointerDown={closeAdvancedLibrary}
        >
          <div
            className="asset-library-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-library-drawer-title"
            aria-describedby="asset-library-drawer-description"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <header>
              <div className="asset-library-drawer-heading">
                <span>Biblioteca</span>
                <h2 id="asset-library-drawer-title">Gerenciar biblioteca</h2>
                <p id="asset-library-drawer-description">
                  Organize, importe e reutilize seus assets.
                </p>
              </div>
              <button
                ref={drawerCloseButtonRef}
                type="button"
                className="asset-library-drawer-close"
                aria-label="Fechar gerenciador de biblioteca"
                onClick={closeAdvancedLibrary}
              >
                <X size={18} aria-hidden="true" />
                <span>Fechar</span>
              </button>
            </header>
            <div className="asset-library-panel">
              <div className="asset-folder-row">
                <label className="sr-only" htmlFor="asset-folder-select">
                  Pasta ativa
                </label>
                <select
                  id="asset-folder-select"
                  className="asset-folder-select"
                  value={activeFolder?.id}
                  onChange={(event) => {
                    const result = setActiveFolder(event.target.value);
                    if (result.ok === false) {
                      setFeedbackMessage(result.error.message);
                    }
                  }}
                >
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="asset-icon-button"
                  aria-label="Nova pasta"
                  onClick={createNewFolder}
                  disabled={folders.length >= MAX_ASSET_FOLDERS}
                >
                  <Plus size={15} />
                </button>
              </div>
              <div className="asset-folder-actions">
                <button type="button" onClick={renameActiveFolder}>
                  Renomear
                </button>
                <button type="button" onClick={deleteActiveFolder}>
                  Excluir pasta
                </button>
              </div>

              <label className="asset-search-label">
                Buscar assets
                <input
                  value={searchQuery}
                  placeholder="Buscar assets..."
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </label>

              <div className="asset-filter-row" aria-label="Filtrar assets">
                {filters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    data-active={activeTypeFilter === filter.value}
                    onClick={() => setTypeFilter(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <label className="asset-sort-label">
                Ordenar
                <select
                  value={sortMode}
                  onChange={(event) =>
                    setSortMode(event.target.value as typeof sortMode)
                  }
                >
                  <option value="recent">Mais recentes</option>
                  <option value="oldest">Mais antigos</option>
                  <option value="name-asc">Nome A-Z</option>
                  <option value="name-desc">Nome Z-A</option>
                  <option value="type">Tipo</option>
                </select>
              </label>

              <button
                type="button"
                className="asset-import-button"
                disabled={!canManageRemoteAssets}
                onClick={() => setImportOpen(true)}
              >
                <Upload size={15} />
                Importar asset
              </button>
              <button
                type="button"
                className="asset-restore-button"
                onClick={restoreDefaultAssets}
              >
                Restaurar assets padrão
              </button>
              <div className="asset-feedback" aria-live="polite">
                {statusMessage ??
                  `${activeFolderCount} de ${MAX_ASSETS_PER_FOLDER} itens`}
              </div>
              {assetUsage && (
                <div
                  className="asset-feedback"
                  aria-label="Uso de armazenamento"
                >
                  Armazenamento: {formatBytes(assetUsage.usedBytes)} de{" "}
                  {formatBytes(assetUsage.limitBytes)}
                </div>
              )}
              {visibleAssets.length > 0 ? (
                <AssetSection
                  title={sectionTitle}
                  assets={visibleAssets}
                  selectedAssetId={selectedAssetId}
                  onSelect={setSelectedAsset}
                  onAdd={canEdit ? addAssetToPage : undefined}
                  onAdded={canEdit ? showAddedFeedback : undefined}
                  onDelete={
                    canManageRemoteAssets ? deleteLibraryAsset : undefined
                  }
                />
              ) : (
                <div className="asset-empty-state">
                  {searchQuery || activeTypeFilter !== "all"
                    ? "Nenhum asset encontrado."
                    : activeFolderCount >= MAX_ASSETS_PER_FOLDER
                      ? "Esta pasta já possui 15 itens."
                      : "Esta pasta ainda não possui itens."}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
      <AssetImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
      <ConfirmationDialog
        open={folderPendingDelete !== null}
        title="Excluir pasta"
        description="Esta pasta será removida. Quando houver outra pasta disponível, os assets serão movidos para ela; caso contrário, os assets importados também serão apagados."
        confirmLabel="Excluir pasta"
        variant="danger"
        onCancel={() => setFolderPendingDelete(null)}
        onConfirm={confirmDeleteFolder}
      />
      <ConfirmationDialog
        open={assetPendingDelete !== null}
        title="Excluir asset"
        description={
          assetPendingDelete
            ? `Excluir "${assetPendingDelete.name}" da biblioteca. Se estiver em uso nas páginas, os elementos relacionados também serão removidos.`
            : "Excluir asset da biblioteca."
        }
        confirmLabel="Excluir asset"
        variant="danger"
        onCancel={() => setAssetPendingDelete(null)}
        onConfirm={() => void confirmDeleteLibraryAsset()}
      />
      </aside>
    </>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
