import { ClipboardList, NotebookTabs, StickyNote } from "lucide-react";
import { useDocumentViewport } from "../../hooks/useDocumentViewport";
import { useAppStore } from "../../stores/useAppStore";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type { DocumentType } from "../../types/document.types";
import { getOrderedPages } from "../../utils/document.utils";
import { EditorZoomControls } from "../editor/EditorZoomControls";
import { PageNavigation } from "../editor/PageNavigation";
import { RulerOverlay } from "../tools/RulerOverlay";
import { ClipboardView } from "./ClipboardView";
import { DocumentScaleLayer } from "./DocumentScaleLayer";
import { NotebookView } from "./NotebookView";
import { NotepadView } from "./NotepadView";

const documentModes: Array<{
  id: DocumentType;
  label: string;
  icon: typeof NotebookTabs;
}> = [
    { id: "notebook", label: "Caderno", icon: NotebookTabs },
    { id: "notepad", label: "Bloco de Notas", icon: StickyNote },
    { id: "clipboard", label: "Prancheta", icon: ClipboardList },
  ];

export function DocumentWorkspace() {
  const documents = useDocumentStore((state) => state.documents);
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const setActiveDocument = useDocumentStore((state) => state.setActiveDocument);
  const setActiveDocumentType = useAppStore((state) => state.setActiveDocumentType);
  const closeContextMenu = useEditorStore((state) => state.closeContextMenu);
  const setEditingTextElementId = useEditorStore((state) => state.setEditingTextElementId);
  const cancelAssetDrag = useEditorStore((state) => state.cancelAssetDrag);
  const editorZoom = useEditorStore((state) => state.editorZoom);
  const zoomMode = useEditorStore((state) => state.zoomMode);
  const setEditorZoom = useEditorStore((state) => state.setEditorZoom);
  const fitEditorZoom = useEditorStore((state) => state.fitEditorZoom);
  const resetEditorZoom = useEditorStore((state) => state.resetEditorZoom);
  const activeDocument =
    documents.find((document) => document.id === activeDocumentId) ?? documents[0];
  const activePages = getOrderedPages(activeDocument);
  const {
    viewportRef,
    geometry,
    scale,
    zoom,
    renderedWidth,
    renderedHeight,
    requiresHorizontalPan,
    requiresVerticalPan,
  } = useDocumentViewport(activeDocument.type, editorZoom, zoomMode);

  const closeFloatingEditorUi = () => {
    cancelAssetDrag();
    closeContextMenu();
    setEditingTextElementId(null);
  };

  return (
    <main className="document-workspace" ref={viewportRef}>
      <div
        className="editor-document-viewport document-stage"
        data-zoom-mode={zoomMode}
        data-pan-x={requiresHorizontalPan}
        data-pan-y={requiresVerticalPan}
      >
        <DocumentScaleLayer
          geometry={geometry}
          renderedWidth={renderedWidth}
          renderedHeight={renderedHeight}
          scale={scale}
          requiresHorizontalPan={requiresHorizontalPan}
          requiresVerticalPan={requiresVerticalPan}
        >
          {activeDocument.type === "notebook" && <NotebookView document={activeDocument} />}
          {activeDocument.type === "notepad" && <NotepadView document={activeDocument} />}
          {activeDocument.type === "clipboard" && <ClipboardView document={activeDocument} />}
          <RulerOverlay />
        </DocumentScaleLayer>
      </div>

      <div className="document-editor-chrome-layer">

        <div className="document-mode-switch" aria-label="Modo do documento">
          {documentModes.map((mode) => {
            const Icon = mode.icon;
            const selected = activeDocument.type === mode.id;
            const documentForMode =
              documents.find((document) => document.type === mode.id) ?? activeDocument;

            return (
              <button
                key={mode.id}
                type="button"
                className="document-mode-button"
                data-active={selected}
                aria-pressed={selected}
                onClick={() => {
                  closeFloatingEditorUi();
                  setActiveDocument(documentForMode.id);
                  setActiveDocumentType(mode.id);
                }}
              >
                <Icon size={16} />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        <div className="document-status-controls">
          <PageNavigation
            document={activeDocument}
            pages={activePages}
          />

          <EditorZoomControls
            scale={scale}
            zoom={zoom}
            zoomMode={zoomMode}
            onZoomChange={setEditorZoom}
            onFitToWindow={fitEditorZoom}
            onResetZoom={resetEditorZoom}
          />
        </div>
      </div>
    </main>
  );
}
