import { useState } from "react";
import {
  Bookmark,
  Eye,
  Image,
  MessageSquare,
  PenTool,
  Plus,
  PlusSquare,
  Shapes,
  Smile,
  Sticker,
  TextCursorInput,
  Trash2,
} from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { useAssetLibraryStore } from "../../stores/useAssetLibraryStore";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type { LibraryAsset } from "../../types/asset.types";
import type { EditorTool } from "../../types/editor.types";
import type { PageElement, ShapeAppearance } from "../../types/element.types";
import { libraryAssetToSidebarAsset } from "../../utils/assetLibrary.utils";
import { createElementFromAsset, createShapeElement } from "../../utils/element.utils";
import { getElementSizing } from "../../utils/elementSizing.utils";
import { getEditableActivePage } from "../../utils/document.utils";
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

type ToolbarItemKind = "tool" | "command";

const tools: Array<{
  id: EditorTool;
  label: string;
  icon: typeof TextCursorInput;
  tone: string;
  kind: ToolbarItemKind;
}> = [
  { id: "text", label: "Texto", icon: TextCursorInput, tone: "blue", kind: "tool" },
  { id: "emojis", label: "Emojis", icon: Smile, tone: "yellow", kind: "tool" },
  { id: "stickers", label: "Formas e stickers", icon: Shapes, tone: "coral", kind: "tool" },
  { id: "image", label: "Imagens", icon: Image, tone: "green", kind: "tool" },
  { id: "tapes", label: "Tapes", icon: Sticker, tone: "pink", kind: "tool" },
  { id: "comments", label: "Comentarios", icon: MessageSquare, tone: "lavender", kind: "tool" },
  { id: "new-page", label: "Nova folha", icon: PlusSquare, tone: "aqua", kind: "command" },
  { id: "pen-ruler", label: "Caneta e regua", icon: PenTool, tone: "soft", kind: "tool" },
  { id: "preview", label: "Visualizacao", icon: Eye, tone: "soft", kind: "command" },
  { id: "favorite", label: "Favoritar", icon: Bookmark, tone: "soft", kind: "command" },
  { id: "erase", label: "Apagar", icon: Trash2, tone: "soft", kind: "tool" },
];

const visibilityControls = [
  ["text", "Textos"],
  ["image", "Imagens"],
  ["sticker", "Stickers"],
  ["tape", "Tapes"],
  ["postIt", "Post-its"],
  ["comment", "Comentarios"],
  ["hidden", "Elementos ocultos"],
] as const;

export function BottomToolbar() {
  const [importOpen, setImportOpen] = useState(false);
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
  const documents = useDocumentStore((state) => state.documents);
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const activePageId = useDocumentStore((state) => state.activePageId);
  const createPage = useDocumentStore((state) => state.createPage);
  const addElement = useDocumentStore((state) => state.addElement);
  const toggleFavoriteActiveDocument = useDocumentStore((state) => state.toggleFavoriteActiveDocument);
  const clearActivePageElements = useDocumentStore((state) => state.clearActivePageElements);
  const deletePage = useDocumentStore((state) => state.deletePage);
  const recordHistory = useEditorStore((state) => state.recordHistory);
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
  const ruler = useEditorStore((state) => state.ruler);
  const setDrawingSettings = useEditorStore((state) => state.setDrawingSettings);
  const setRuler = useEditorStore((state) => state.setRuler);
  const libraryAssets = useAssetLibraryStore((state) => state.assets);
  const activeDocument = documents.find((document) => document.id === activeDocumentId);
  const activePage = activeDocument ? getEditableActivePage(activeDocument) : undefined;
  const activePageIndex = activeDocument?.pages.findIndex((page) => page.id === activePage?.id) ?? -1;
  const destinationLabel =
    !activePage
      ? "Sem folha ativa"
      :
    activeDocument?.type === "notebook" && activePageIndex >= 0
      ? `Destino: ${activePageIndex % 2 === 0 ? "Pagina esquerda" : "Pagina direita"}`
      : `Destino: Pagina ${activePage?.order ?? "-"}`;
  const stickers = libraryAssets.filter((asset) => asset.type === "sticker");
  const images = libraryAssets.filter((asset) => asset.type === "image");
  const tapes = libraryAssets.filter((asset) => asset.type === "tape");

  const insertElement = (element: PageElement) => {
    if (!activePage) {
      return false;
    }
    const placed = placeElementForInsertion({
      element,
      existingElements: activePage.elements,
    });
    recordHistory(documents);
    addElement(activePage.id, placed);
    return true;
  };

  const insertAsset = (asset: LibraryAsset) => {
    return insertElement(createElementFromAsset(libraryAssetToSidebarAsset(asset)));
  };

  const insertEmoji = (emoji: string) => {
    const emojiSizing = getElementSizing("emoji");
    return insertElement({
      id: `el-${crypto.randomUUID()}`,
      type: "emoji",
      x: 40,
      y: 40,
      width: emojiSizing.defaultWidth,
      height: emojiSizing.defaultHeight,
      minWidth: emojiSizing.minWidth,
      minHeight: emojiSizing.minHeight,
      lockAspectRatio: emojiSizing.lockAspectRatioByDefault,
      rotation: 0,
      zIndex: 10,
      locked: false,
      hidden: false,
      content: { kind: "emoji", emoji },
      style: { text: { textAlign: "center" } },
    });
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
      recordHistory(documents);
      createPage();
      setActiveToolPanel(null);
      return;
    }

    if (tool === "favorite") {
      recordHistory(documents);
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
      setEditorMode("text");
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
              ? "Comentarios"
              : activeToolPanel === "drawing"
                ? "Caneta e regua"
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

  return (
    <div className="bottom-toolbar-wrap">
      <div className="bottom-toolbar" role="toolbar" aria-label="Ferramentas">
        {tools.map((tool) => (
          <ToolButton
            key={tool.id}
            id={tool.id}
            label={tool.label}
            icon={tool.icon}
            tone={tool.tone}
            active={
              tool.kind === "tool"
                ? activeTool === tool.id || (tool.id === "erase" && editorMode === "erase")
                : (tool.id === "favorite" && Boolean(activeDocument?.favorite)) ||
                  (tool.id === "preview" && visibilityPanelOpen)
            }
            onSelect={handleSelect}
          />
        ))}

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
                onPick={(emoji) => {
                  if (insertEmoji(emoji)) {
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
              <p className="tool-panel-note">Clique em uma folha para escrever um comentario.</p>
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
      <AssetImportModal
        key={`${importType}-${svgImportMode}`}
        open={importOpen}
        initialType={importType}
        svgMode={svgImportMode}
        onClose={() => setImportOpen(false)}
      />
      <ConfirmationDialog
        open={confirmation === "clear-page"}
        title="Limpar página"
        description={`Remover ${activePage?.elements.filter((element) => !element.locked).length ?? 0} elemento(s) desbloqueado(s). Elementos bloqueados serão preservados.`}
        confirmLabel="Limpar página"
        variant="warning"
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          if (activePage) {
            recordHistory(documents);
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
            recordHistory(documents);
            deletePage(activePageId);
          }
          setConfirmation(null);
        }}
      />
    </div>
  );
}
