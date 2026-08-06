import { PanelLeftClose, PanelLeftOpen, Plus, Settings2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { PaperSettings } from "../editor/PaperSettings";
import { DevelopmentSettings } from "../editor/DevelopmentSettings";
import { ThemeSelector } from "../theme/ThemeSelector";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { AssetImportModal } from "./AssetImportModal";
import { AssetSection } from "./AssetSection";

const filters: Array<{ value: AssetTypeFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "sticker", label: "Stickers" },
  { value: "image", label: "Images" },
  { value: "post-it", label: "Post-its" },
  { value: "tape", label: "Tapes" },
];

export function Sidebar() {
  const sidebarVisible = useAppStore((state) => state.sidebarVisible);
  const setSidebarVisible = useAppStore((state) => state.setSidebarVisible);
  const documents = useDocumentStore((state) => state.documents);
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const addElement = useDocumentStore((state) => state.addElement);
  const updatePage = useDocumentStore((state) => state.updatePage);
  const recordHistory = useEditorStore((state) => state.recordHistory);
  const cancelAssetDrag = useEditorStore((state) => state.cancelAssetDrag);
  const folders = useAssetLibraryStore((state) => state.folders);
  const assets = useAssetLibraryStore((state) => state.assets);
  const activeFolderId = useAssetLibraryStore((state) => state.activeFolderId);
  const selectedAssetId = useAssetLibraryStore((state) => state.selectedAssetId);
  const searchQuery = useAssetLibraryStore((state) => state.searchQuery);
  const activeTypeFilter = useAssetLibraryStore((state) => state.activeTypeFilter);
  const sortMode = useAssetLibraryStore((state) => state.sortMode);
  const feedbackMessage = useAssetLibraryStore((state) => state.feedbackMessage);
  const importError = useAssetLibraryStore((state) => state.importError);
  const createFolder = useAssetLibraryStore((state) => state.createFolder);
  const renameFolder = useAssetLibraryStore((state) => state.renameFolder);
  const deleteFolder = useAssetLibraryStore((state) => state.deleteFolder);
  const setActiveFolder = useAssetLibraryStore((state) => state.setActiveFolder);
  const setSelectedAsset = useAssetLibraryStore((state) => state.setSelectedAsset);
  const setSearchQuery = useAssetLibraryStore((state) => state.setSearchQuery);
  const setTypeFilter = useAssetLibraryStore((state) => state.setTypeFilter);
  const setSortMode = useAssetLibraryStore((state) => state.setSortMode);
  const deleteAsset = useAssetLibraryStore((state) => state.deleteAsset);
  const restoreDefaultAssets = useAssetLibraryStore((state) => state.restoreDefaultAssets);
  const getFilteredAssets = useAssetLibraryStore((state) => state.getFilteredAssets);
  const setFeedbackMessage = useAssetLibraryStore((state) => state.setFeedbackMessage);
  const [importOpen, setImportOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<"library" | "appearance">("library");
  const [folderPendingDelete, setFolderPendingDelete] = useState<string | null>(null);
  const [assetPendingDelete, setAssetPendingDelete] = useState<LibraryAsset | null>(null);
  const activeFolder = folders.find((folder) => folder.id === activeFolderId) ?? folders[0];
  const activeDocument = documents.find((document) => document.id === activeDocumentId);
  const editableActivePage = activeDocument ? getEditableActivePage(activeDocument) : undefined;
  const visibleAssets = getFilteredAssets();
  const activeFolderCount = assets.filter((asset) => asset.folderId === activeFolder?.id).length;
  const statusMessage = importError?.message ?? feedbackMessage;

  const sectionTitle = useMemo(() => activeFolder?.name ?? "Biblioteca", [activeFolder]);
  const simpleSections = useMemo(
    () => [
      { title: "Stickers", assets: assets.filter((asset) => asset.type === "sticker").slice(0, 6) },
      { title: "Images", assets: assets.filter((asset) => asset.type === "image").slice(0, 6) },
      { title: "Post-its", assets: assets.filter((asset) => asset.type === "post-it").slice(0, 6) },
      { title: "Tapes", assets: assets.filter((asset) => asset.type === "tape").slice(0, 6) },
    ],
    [assets],
  );

  useEffect(() => {
    if (!advancedOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAdvancedOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [advancedOpen]);

  const showAddedFeedback = (assetId: string) => {
    setSelectedAsset(assetId);
    setFeedbackMessage("Asset adicionado a pagina.");
    window.setTimeout(() => setFeedbackMessage(null), 900);
  };

  const addAssetToPage = (asset: SidebarAsset) => {
    const page = editableActivePage;
    if (!page) {
      return;
    }
    const element = placeElementForInsertion({
      element: createElementFromAsset(asset),
      existingElements: page.elements,
    });
    recordHistory(documents);
    addElement(page.id, element);
    showAddedFeedback(asset.id);
  };

  const createNewFolder = () => {
    const name = window.prompt("Nome da nova pasta", `Pasta ${folders.length + 1}`);
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
    const otherFolder = folders.find((folder) => folder.id !== folderPendingDelete);
    const result = deleteFolder(folderPendingDelete, otherFolder?.id);
    if (result.ok === false) {
      setFeedbackMessage(result.error.message);
      setFolderPendingDelete(null);
      return;
    }
    void Promise.all(result.value.map((assetId) => indexedDbAssetStorage.deleteAssetBlob(assetId)));
    setFolderPendingDelete(null);
  };

  const removeAssetFromPages = (assetId: string) => {
    recordHistory(documents);
    documents.forEach((document) => {
      document.pages.forEach((page) => {
        if (page.elements.some((element) => "assetId" in element.content && element.content.assetId === assetId)) {
          updatePage(page.id, {
            elements: page.elements.filter(
              (element) => !("assetId" in element.content) || element.content.assetId !== assetId,
            ),
          });
        }
      });
    });
  };

  const deleteLibraryAsset = (asset: LibraryAsset) => {
    setAssetPendingDelete(asset);
  };

  const confirmDeleteLibraryAsset = () => {
    const asset = assetPendingDelete;
    if (!asset) {
      return;
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
      <aside className="asset-sidebar asset-sidebar-collapsed" aria-label="Biblioteca recolhida">
        <button
          type="button"
          className="sidebar-toggle"
          aria-label="Mostrar biblioteca de assets"
          onClick={() => setSidebarVisible(true)}
        >
          <PanelLeftOpen size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="asset-sidebar" aria-label="Biblioteca de assets">
      <header className="asset-sidebar-header">
        <span>Biblioteca</span>
        <button
          type="button"
          className="asset-manage-button"
          aria-label="Gerenciar biblioteca"
          onClick={() => setAdvancedOpen(true)}
        >
          <Settings2 size={15} />
        </button>
        <button
          type="button"
          className="sidebar-toggle"
          aria-label="Recolher biblioteca de assets"
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
          <div className="asset-sidebar-panel" role="tabpanel" aria-label="Biblioteca">
            <div className="asset-feedback" aria-live="polite">
              {statusMessage ?? `${activeFolderCount} de ${MAX_ASSETS_PER_FOLDER} itens`}
            </div>
            {simpleSections.map((section) => (
              <AssetSection
                key={section.title}
                title={section.title}
                assets={section.assets}
                selectedAssetId={selectedAssetId}
                onSelect={setSelectedAsset}
                onAdd={addAssetToPage}
                onAdded={showAddedFeedback}
                showActions={false}
              />
            ))}
          </div>
        ) : (
          <div className="asset-sidebar-panel appearance-sidebar-panel" role="tabpanel" aria-label="Aparência">
            <h2>Aparência</h2>
            <ThemeSelector />
            <PaperSettings />
            <DevelopmentSettings />
          </div>
        )}
      </div>
      {advancedOpen && (
        <div
          className="asset-library-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Gerenciar biblioteca"
          onPointerDown={() => setAdvancedOpen(false)}
        >
          <div className="asset-library-drawer-panel" onPointerDown={(event) => event.stopPropagation()}>
            <header>
              <h2>Gerenciar biblioteca</h2>
              <button type="button" onClick={() => setAdvancedOpen(false)}>
                Fechar
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
                <button type="button" className="asset-icon-button" aria-label="Nova pasta" onClick={createNewFolder} disabled={folders.length >= MAX_ASSET_FOLDERS}>
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
                <select value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}>
                  <option value="recent">Mais recentes</option>
                  <option value="oldest">Mais antigos</option>
                  <option value="name-asc">Nome A-Z</option>
                  <option value="name-desc">Nome Z-A</option>
                  <option value="type">Tipo</option>
                </select>
              </label>

              <button type="button" className="asset-import-button" onClick={() => setImportOpen(true)}>
                <Upload size={15} />
                Importar asset
              </button>
              <button type="button" className="asset-restore-button" onClick={restoreDefaultAssets}>
                Restaurar assets padrao
              </button>
              <div className="asset-feedback" aria-live="polite">
                {statusMessage ?? `${activeFolderCount} de ${MAX_ASSETS_PER_FOLDER} itens`}
              </div>
              {visibleAssets.length > 0 ? (
                <AssetSection
                  title={sectionTitle}
                  assets={visibleAssets}
                  selectedAssetId={selectedAssetId}
                  onSelect={setSelectedAsset}
                  onAdd={addAssetToPage}
                  onAdded={showAddedFeedback}
                  onDelete={deleteLibraryAsset}
                />
              ) : (
                <div className="asset-empty-state">
                  {searchQuery || activeTypeFilter !== "all"
                    ? "Nenhum asset encontrado."
                    : activeFolderCount >= MAX_ASSETS_PER_FOLDER
                      ? "Esta pasta ja possui 15 itens."
                      : "Esta pasta ainda nao possui itens."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <AssetImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <ConfirmationDialog
        open={folderPendingDelete !== null}
        title="Excluir pasta"
        description="Esta pasta sera removida. Quando houver outra pasta disponivel, os assets serao movidos para ela; caso contrario, os assets importados tambem serao apagados."
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
            ? `Excluir "${assetPendingDelete.name}" da biblioteca. Se estiver em uso nas paginas, os elementos relacionados tambem serao removidos.`
            : "Excluir asset da biblioteca."
        }
        confirmLabel="Excluir asset"
        variant="danger"
        onCancel={() => setAssetPendingDelete(null)}
        onConfirm={confirmDeleteLibraryAsset}
      />
    </aside>
  );
}
