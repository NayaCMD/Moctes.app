import { Fragment, useState } from "react";
import {
  Bookmark,
  Eye,
  Image,
  Library,
  ListChecks,
  Lock,
  MessageSquare,
  MoreHorizontal,
  PenTool,
  Plus,
  PlusSquare,
  Shapes,
  Smile,
  Sticker,
  SlidersHorizontal,
  TextCursorInput,
  Trash2,
  Undo2,
  Redo2,
  X,
} from "lucide-react";
import { useIsCompactTouchEditor } from "../../hooks/useResponsiveEditor";
import { useWorkspaceCapabilities } from "../../hooks/useWorkspaceCapabilities";
import { useAppStore } from "../../stores/useAppStore";
import { useAssetLibraryStore } from "../../stores/useAssetLibraryStore";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type { LibraryAsset } from "../../types/asset.types";
import type { EmojiCatalogItem } from "../../types/emoji.types";
import type { EditorTool } from "../../types/editor.types";
import type { PageElement, ShapeAppearance } from "../../types/element.types";
import { libraryAssetToSidebarAsset } from "../../utils/assetLibrary.utils";
import { createElementFromAsset, createShapeElement } from "../../utils/element.utils";
import { getEditableActivePage } from "../../utils/document.utils";
import { createEmojiElement } from "../../utils/emoji.utils";
import { placeElementForInsertion } from "../../utils/insertion.utils";
import { AssetImportModal } from "../sidebar/AssetImportModal";
import { AssetPickerPanel } from "../tools/AssetPickerPanel";
import { DrawingPanel } from "../tools/DrawingPanel";
import { EmojiPicker } from "../tools/EmojiPicker";
import { EraserOptions } from "../tools/EraserOptions";
import { ShapeStickerPicker } from "../tools/ShapeStickerPicker";
import { ToolPopover, type ToolPopoverAnchor } from "../tools/ToolPopover";
import { ConfirmationDialog } from "../ui/ConfirmationDialog";
import { ToolButton } from "./ToolButton";
import { PageTemplatePicker } from "../templates/PageTemplatePicker";

type ToolbarItemKind = "tool" | "command";

const tools: Array<{
  id: EditorTool;
  label: string;
  icon: typeof TextCursorInput;
  tone: string;
  kind: ToolbarItemKind;
}> = [
  { id: "text", label: "Texto", icon: TextCursorInput, tone: "blue", kind: "tool" },
  { id: "checklist", label: "Checklist", icon: ListChecks, tone: "blue", kind: "tool" },
  { id: "emojis", label: "Emojis", icon: Smile, tone: "yellow", kind: "tool" },
  { id: "stickers", label: "Formas e stickers", icon: Shapes, tone: "coral", kind: "tool" },
  { id: "image", label: "Imagens", icon: Image, tone: "green", kind: "tool" },
  { id: "tapes", label: "Tapes", icon: Sticker, tone: "pink", kind: "tool" },
  { id: "comments", label: "Comentários", icon: MessageSquare, tone: "lavender", kind: "tool" },
  { id: "new-page", label: "Nova página", icon: PlusSquare, tone: "aqua", kind: "command" },
  { id: "pen-ruler", label: "Caneta e régua", icon: PenTool, tone: "soft", kind: "tool" },
  { id: "preview", label: "Visualização", icon: Eye, tone: "soft", kind: "command" },
  { id: "favorite", label: "Favoritar", icon: Bookmark, tone: "soft", kind: "command" },
  { id: "erase", label: "Apagar", icon: Trash2, tone: "soft", kind: "tool" },
];

const visibilityControls = [
  ["text", "Textos"],
  ["checklist", "Checklists"],
  ["image", "Imagens"],
  ["sticker", "Stickers"],
  ["tape", "Tapes"],
  ["postIt", "Post-its"],
  ["comment", "Comentários"],
  ["hidden", "Elementos ocultos"],
] as const;

const mobilePrimaryToolIds: EditorTool[] = ["text", "image", "pen-ruler", "stickers"];

export function BottomToolbar() {
  const isCompactTouchEditor = useIsCompactTouchEditor();
  const { canEdit } = useWorkspaceCapabilities();
  const [importOpen, setImportOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [importType, setImportType] = useState<LibraryAsset["type"]>("image");
  const [svgImportMode, setSvgImportMode] = useState<"shape" | "sticker">("sticker");
  const [panelAnchor, setPanelAnchor] = useState<ToolPopoverAnchor | null>(null);
  const [activeButtonElement, setActiveButtonElement] = useState<HTMLButtonElement | null>(null);
  const [shapeFill, setShapeFill] = useState("#dfe8ff");
  const [shapeBorder, setShapeBorder] = useState("#8da3ed");
  const [shapeBorderWidth, setShapeBorderWidth] = useState(2);
  const [drawingTab, setDrawingTab] = useState<"pen" | "ruler">("pen");
  const [confirmation, setConfirmation] = useState<"clear-page" | "delete-page" | null>(null);
  const activeTool = useAppStore((state) => state.activeTool);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const setSidebarVisible = useAppStore((state) => state.setSidebarVisible);
  const setActiveSidebarTab = useAppStore((state) => state.setActiveSidebarTab);
  const documents = useDocumentStore((state) => state.documents);
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const activePageId = useDocumentStore((state) => state.activePageId);
  const selectedElementId = useDocumentStore((state) => state.selectedElementId);
  const createPageFromTemplate = useDocumentStore((state) => state.createPageFromTemplate);
  const addElement = useDocumentStore((state) => state.addElement);
  const toggleFavoriteActiveDocument = useDocumentStore((state) => state.toggleFavoriteActiveDocument);
  const clearActivePageElements = useDocumentStore((state) => state.clearActivePageElements);
  const deletePage = useDocumentStore((state) => state.deletePage);
  const activeToolPanel = useEditorStore((state) => state.activeToolPanel);
  const setActiveToolPanel = useEditorStore((state) => state.setActiveToolPanel);
  const editorMode = useEditorStore((state) => state.editorMode);
  const setEditorMode = useEditorStore((state) => state.setEditorMode);
  const visibilityPanelOpen = useEditorStore((state) => state.visibilityPanelOpen);
  const toggleVisibilityPanel = useEditorStore((state) => state.toggleVisibilityPanel);
  const visibilityFilters = useEditorStore((state) => state.visibilityFilters);
  const setVisibilityFilter = useEditorStore((state) => state.setVisibilityFilter);
  const drawingSettings = useEditorStore((state) => state.drawingSettings);
  const drawingPreview = useEditorStore((state) => state.drawingPreview);
  const notebookTransition = useEditorStore((state) => state.notebookTransition);
  const notebookBook = useEditorStore((state) => state.notebookBook);
  const ruler = useEditorStore((state) => state.ruler);
  const undoCount = useEditorStore((state) => state.undoStack.length);
  const redoCount = useEditorStore((state) => state.redoStack.length);
  const setDrawingSettings = useEditorStore((state) => state.setDrawingSettings);
  const setRuler = useEditorStore((state) => state.setRuler);
  const libraryAssets = useAssetLibraryStore((state) => state.assets);
  const activeDocument = documents.find((document) => document.id === activeDocumentId);
  const activePage = activeDocument
    ? getEditableActivePage(activeDocument, { notebookBook, notebookTransition })
    : undefined;
  const notebookPhase =
    activeDocument?.type === "notebook" && notebookBook?.documentId === activeDocument.id
      ? notebookBook.phase
      : activeDocument?.type === "notebook"
        ? "closed"
        : "open";
  const toolbarDisabled = activeDocument?.type === "notebook" && notebookPhase !== "open";
  const destinationLabel =
    !activePage
      ? "Sem página ativa"
      : activeDocument?.type === "notebook"
        ? "Destino: página direita"
        : `Destino: página ${activePage.order}`;
  const stickers = libraryAssets.filter((asset) => asset.type === "sticker");
  const images = libraryAssets.filter((asset) => asset.type === "image");
  const tapes = libraryAssets.filter((asset) => asset.type === "tape");
  const visibleTools = isCompactTouchEditor
    ? mobilePrimaryToolIds
        .map((toolId) => tools.find((tool) => tool.id === toolId))
        .filter((tool): tool is (typeof tools)[number] => Boolean(tool))
    : tools;
  const mobileSecondaryTools = tools.filter(
    (tool) => !mobilePrimaryToolIds.includes(tool.id),
  );

  const runUndo = () => {
    const documentState = useDocumentStore.getState();
    const next = useEditorStore.getState().undo(documentState.documents);
    if (next) {
      documentState.applyDocumentsSnapshot(next);
    }
  };

  const runRedo = () => {
    const documentState = useDocumentStore.getState();
    const next = useEditorStore.getState().redo(documentState.documents);
    if (next) {
      documentState.applyDocumentsSnapshot(next);
    }
  };

  const insertElement = (element: PageElement) => {
    if (!activePage) {
      return false;
    }
    const placed = placeElementForInsertion({
      element,
      existingElements: activePage.elements,
    });
    addElement(activePage.id, placed);
    return true;
  };

  const insertAsset = (asset: LibraryAsset) => {
    return insertElement(createElementFromAsset(libraryAssetToSidebarAsset(asset)));
  };

  const insertEmoji = (item: EmojiCatalogItem) => {
    return insertElement(createEmojiElement(item));
  };

  const insertShape = (shape: ShapeAppearance["shapeType"]) => {
    return insertElement(
      createShapeElement({
        shape,
        fillColor: shapeFill,
        strokeColor: shapeBorder,
        strokeWidth: shapeBorderWidth,
      }),
    );
  };

  const focusActiveButton = () => {
    window.setTimeout(() => activeButtonElement?.focus({ preventScroll: true }), 0);
  };

  const closeActivePanel = () => {
    if (activeToolPanel === "visibility" && visibilityPanelOpen) {
      toggleVisibilityPanel();
    }
    setActiveToolPanel(null);
    setPanelAnchor(null);
    focusActiveButton();
  };

  const openPanel = (
    panel: NonNullable<typeof activeToolPanel>,
    anchor: ToolPopoverAnchor,
    button: HTMLButtonElement,
  ) => {
    setPanelAnchor(anchor);
    setActiveButtonElement(button);
    setActiveToolPanel(activeToolPanel === panel ? null : panel);
  };

  const handleSelect = (tool: EditorTool, anchor: ToolPopoverAnchor, button: HTMLButtonElement) => {
    if (tool === "new-page") {
      setTemplatePickerOpen(true);
      setActiveToolPanel(null);
      setMobileMoreOpen(false);
      return;
    }

    if (tool === "favorite") {
      toggleFavoriteActiveDocument();
      setActiveToolPanel(null);
      return;
    }

    if (tool === "preview") {
      toggleVisibilityPanel();
      openPanel("visibility", anchor, button);
      return;
    }

    if (tool === "erase") {
      setActiveTool(tool);
      setEditorMode(editorMode === "erase" ? "select" : "erase");
      openPanel("erase", anchor, button);
      return;
    }

    setActiveTool(tool);
    if (tool === "text") {
      useDocumentStore.getState().clearSelection();
      setEditorMode(editorMode === "text" ? "select" : "text");
      setActiveToolPanel(null);
    }
    if (tool === "checklist") {
      useDocumentStore.getState().clearSelection();
      setEditorMode(editorMode === "checklist" ? "select" : "checklist");
      setActiveToolPanel(null);
    }
    if (tool === "comments") {
      setEditorMode("comment");
      openPanel("comments", anchor, button);
    }
    if (tool === "emojis") {
      setEditorMode("select");
      openPanel("emoji", anchor, button);
    }
    if (tool === "stickers") {
      setEditorMode("select");
      openPanel("shapes", anchor, button);
    }
    if (tool === "image") {
      setEditorMode("select");
      openPanel("images", anchor, button);
    }
    if (tool === "tapes") {
      setEditorMode("select");
      openPanel("tapes", anchor, button);
    }
    if (tool === "pen-ruler") {
      setEditorMode("draw");
      setDrawingTab("pen");
      openPanel("drawing", anchor, button);
    }
  };

  const panelTitle =
    activeToolPanel === "emoji"
      ? "Emojis"
      : activeToolPanel === "shapes"
        ? "Formas e stickers"
        : activeToolPanel === "images"
          ? "Imagens"
          : activeToolPanel === "tapes"
            ? "Tapes"
            : activeToolPanel === "comments"
              ? "Comentários"
              : activeToolPanel === "drawing"
                ? "Caneta e régua"
                : activeToolPanel === "erase"
                  ? "Apagar"
                  : "Ferramentas";
  const popoverFooter =
    activeToolPanel === "drawing" ||
    activeToolPanel === "visibility" ||
    activeToolPanel === "comments" ||
    activeToolPanel === "erase" ? (
      <span className="tool-destination">{destinationLabel}</span>
    ) : undefined;

  if (!canEdit) {
    return (
      <div className="bottom-toolbar-wrap bottom-toolbar-readonly">
        <div className="bottom-toolbar" role="status" aria-label="Documento somente leitura">
          <span className="readonly-toolbar-message">
            <Lock size={17} aria-hidden="true" />
            Somente leitura
          </span>
          <button
            type="button"
            className="tool-button mobile-library-trigger"
            aria-label="Consultar biblioteca"
            data-label="Biblioteca"
            onClick={() => {
              setActiveSidebarTab("library");
              setSidebarVisible(true);
            }}
          >
            <Library size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bottom-toolbar-wrap">
      {isCompactTouchEditor && selectedElementId && (
        <button
          type="button"
          className="mobile-properties-trigger"
          onClick={() => {
            setActiveSidebarTab("appearance");
            setSidebarVisible(true);
          }}
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          Propriedades
        </button>
      )}
      <div
        className="bottom-toolbar"
        role="toolbar"
        aria-label="Ferramentas"
        data-disabled={toolbarDisabled}
      >
        {!isCompactTouchEditor && (
          <>
            <button
              type="button"
              className="tool-button toolbar-history-command"
              aria-label="Desfazer"
              data-label="Desfazer"
              disabled={toolbarDisabled || undoCount === 0}
              onClick={runUndo}
            >
              <Undo2 size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="tool-button toolbar-history-command"
              aria-label="Refazer"
              data-label="Refazer"
              disabled={toolbarDisabled || redoCount === 0}
              onClick={runRedo}
            >
              <Redo2 size={19} aria-hidden="true" />
            </button>
            <span className="toolbar-divider" aria-hidden="true" />
          </>
        )}
        {visibleTools.map((tool) => (
          <Fragment key={tool.id}>
            {!isCompactTouchEditor &&
              (tool.id === "new-page" || tool.id === "preview") && (
                <span className="toolbar-divider" aria-hidden="true" />
              )}
            <ToolButton
              id={tool.id}
              label={tool.label}
              icon={tool.icon}
              tone={tool.tone}
              variant={tool.id === "erase" ? "danger" : tool.kind}
              active={
                tool.kind === "tool"
                  ? tool.id === "text"
                    ? editorMode === "text"
                    : tool.id === "checklist"
                      ? editorMode === "checklist"
                    : activeTool === tool.id || (tool.id === "erase" && editorMode === "erase")
                  : (tool.id === "favorite" && Boolean(activeDocument?.favorite)) ||
                    (tool.id === "preview" && visibilityPanelOpen)
              }
              disabled={toolbarDisabled}
              onSelect={handleSelect}
            />
          </Fragment>
        ))}

        {isCompactTouchEditor && (
          <>
            <button
              type="button"
              className="tool-button mobile-library-trigger"
              aria-label="Abrir biblioteca"
              data-label="Biblioteca"
              onClick={() => {
                setMobileMoreOpen(false);
                setActiveSidebarTab("library");
                setSidebarVisible(true);
              }}
            >
              <Library size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="tool-button mobile-more-trigger"
              aria-label="Mais ferramentas"
              aria-expanded={mobileMoreOpen}
              data-label="Mais"
              data-active={mobileMoreOpen}
              onClick={() => {
                setActiveToolPanel(null);
                setMobileMoreOpen((open) => !open);
              }}
            >
              <MoreHorizontal size={21} aria-hidden="true" />
            </button>
          </>
        )}

        {activeToolPanel && (
          <ToolPopover
            title={panelTitle}
            panel={activeToolPanel}
            anchor={panelAnchor}
            headerAction={
              activeToolPanel === "shapes" ? (
                <button
                  type="button"
                  aria-label="Importar forma ou sticker SVG"
                  title="Importar SVG"
                  onClick={() => {
                    setSvgImportMode("sticker");
                    setImportType("sticker");
                    setImportOpen(true);
                  }}
                >
                  <Plus size={15} />
                </button>
              ) : undefined
            }
            footer={popoverFooter}
            onClose={closeActivePanel}
            returnFocusTo={activeButtonElement}
          >
            {activeToolPanel === "visibility" && (
              <div className="visibility-panel-inline" aria-label="Filtros de visualizacao">
                {visibilityControls.map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={visibilityFilters[key]}
                      onChange={(event) => setVisibilityFilter(key, event.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
            {activeToolPanel === "emoji" && (
              <EmojiPicker
                destinationLabel={destinationLabel}
                onPick={(item, options) => {
                  if (insertEmoji(item) && !options.keepOpen) {
                    closeActivePanel();
                  }
                }}
                onDragInserted={(_item, options) => {
                  if (!options.keepOpen) {
                    closeActivePanel();
                  }
                }}
              />
            )}
            {activeToolPanel === "shapes" && (
              <ShapeStickerPicker
                stickers={stickers}
                destinationLabel={destinationLabel}
                fillColor={shapeFill}
                borderColor={shapeBorder}
                borderWidth={shapeBorderWidth}
                onFillColorChange={setShapeFill}
                onBorderColorChange={setShapeBorder}
                onBorderWidthChange={setShapeBorderWidth}
                onPickShape={(shape) => {
                  if (insertShape(shape)) {
                    closeActivePanel();
                  }
                }}
                onImportShapeSvg={() => {
                  setSvgImportMode("shape");
                  setImportType("sticker");
                  setImportOpen(true);
                }}
                onImportStickerSvg={() => {
                  setSvgImportMode("sticker");
                  setImportType("sticker");
                  setImportOpen(true);
                }}
                onPickSticker={(asset) => {
                  if (insertAsset(asset)) {
                    closeActivePanel();
                  }
                }}
              />
            )}
            {activeToolPanel === "images" && (
              <AssetPickerPanel
                title="Imagens"
                assets={images}
                emptyMessage="Nenhuma imagem nesta pasta."
                destinationLabel={destinationLabel}
                onPick={(asset) => {
                  if (insertAsset(asset)) {
                    closeActivePanel();
                  }
                }}
                onImport={() => {
                  setSvgImportMode("sticker");
                  setImportType("image");
                  setImportOpen(true);
                }}
                variant="image"
              />
            )}
            {activeToolPanel === "tapes" && (
              <AssetPickerPanel
                title="Tapes"
                assets={tapes}
                emptyMessage="Nenhuma tape nesta pasta."
                destinationLabel={destinationLabel}
                onPick={(asset) => {
                  if (insertAsset(asset)) {
                    closeActivePanel();
                  }
                }}
                onImport={() => {
                  setSvgImportMode("sticker");
                  setImportType("tape");
                  setImportOpen(true);
                }}
                variant="tape"
              />
            )}
            {activeToolPanel === "comments" && (
              <p className="tool-panel-note">Clique em uma página para escrever um comentário.</p>
            )}
            {activeToolPanel === "drawing" && (
              <DrawingPanel
                activeTab={drawingTab}
                settings={drawingSettings}
                ruler={ruler}
                isDrawing={Boolean(drawingPreview)}
                onActiveTabChange={setDrawingTab}
                onSettingsChange={setDrawingSettings}
                onRulerChange={setRuler}
                onDrawMode={() => setEditorMode("draw")}
                onRulerMode={() => {
                  setEditorMode("ruler");
                  setRuler({ visible: true });
                }}
              />
            )}
            {activeToolPanel === "erase" && (
              <EraserOptions
                onEraseMode={() => {
                  setEditorMode("erase");
                  setActiveToolPanel(null);
                }}
                onEraseAreaMode={() => {
                  setEditorMode("erase-area");
                  setActiveToolPanel(null);
                }}
                onClearPage={() => {
                  setConfirmation("clear-page");
                  setActiveToolPanel(null);
                }}
                onDeletePage={() => {
                  setConfirmation("delete-page");
                  setActiveToolPanel(null);
                }}
              />
            )}
          </ToolPopover>
        )}

      </div>
      {isCompactTouchEditor && mobileMoreOpen && (
        <>
          <button
            type="button"
            className="mobile-tool-sheet-backdrop"
            aria-label="Fechar mais ferramentas"
            onClick={() => setMobileMoreOpen(false)}
          />
          <section className="mobile-tool-sheet" role="dialog" aria-modal="true" aria-label="Mais ferramentas">
            <header>
              <div>
                <strong>Mais ferramentas</strong>
                <span>Ações secundárias do editor</span>
              </div>
              <button type="button" aria-label="Fechar mais ferramentas" onClick={() => setMobileMoreOpen(false)}>
                <X size={19} aria-hidden="true" />
              </button>
            </header>
            <div className="mobile-tool-sheet-grid">
              <button type="button" disabled={undoCount === 0} onClick={runUndo}>
                <Undo2 size={20} aria-hidden="true" />
                <span>Desfazer</span>
              </button>
              <button type="button" disabled={redoCount === 0} onClick={runRedo}>
                <Redo2 size={20} aria-hidden="true" />
                <span>Refazer</span>
              </button>
              {mobileSecondaryTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    disabled={toolbarDisabled}
                    data-variant={tool.id === "erase" ? "danger" : tool.kind}
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      setMobileMoreOpen(false);
                      handleSelect(
                        tool.id,
                        { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                        event.currentTarget,
                      );
                    }}
                  >
                    <Icon size={20} aria-hidden="true" />
                    <span>{tool.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}
      <AssetImportModal
        key={`${importType}-${svgImportMode}`}
        open={importOpen}
        initialType={importType}
        svgMode={svgImportMode}
        onClose={() => setImportOpen(false)}
      />
      {activeDocument && (
        <PageTemplatePicker
          open={templatePickerOpen}
          documentType={activeDocument.type}
          onClose={() => setTemplatePickerOpen(false)}
          onSelect={(templateId) => {
            createPageFromTemplate({
              documentId: activeDocument.id,
              sectionId: activePage?.sectionId,
              templateId,
            });
            setTemplatePickerOpen(false);
          }}
        />
      )}
      <ConfirmationDialog
        open={confirmation === "clear-page"}
        title="Limpar página"
        description={`Remover ${activePage?.elements.filter((element) => !element.locked).length ?? 0} elemento(s) desbloqueado(s). Elementos bloqueados serão preservados.`}
        confirmLabel="Limpar página"
        variant="warning"
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          if (activePage) {
            clearActivePageElements();
          }
          setConfirmation(null);
        }}
      />
      <ConfirmationDialog
        open={confirmation === "delete-page"}
        title="Excluir página"
        description={`Excluir a página ${activePage?.order ?? ""} e seus elementos. O documento continuará com pelo menos uma página válida.`}
        confirmLabel="Excluir página"
        variant="danger"
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          if (activePage) {
            deletePage(activePageId);
          }
          setConfirmation(null);
        }}
      />
    </div>
  );
}
