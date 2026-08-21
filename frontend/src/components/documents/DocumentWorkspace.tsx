import type { PointerEvent as ReactPointerEvent } from "react";
import { useDocumentViewport } from "../../hooks/useDocumentViewport";
import { useTouchDocumentGestures } from "../../hooks/useTouchDocumentGestures";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { getOrderedPages } from "../../utils/document.utils";
import { EditorZoomControls } from "../editor/EditorZoomControls";
import { PageNavigation } from "../editor/PageNavigation";
import { RulerOverlay } from "../tools/RulerOverlay";
import { ClipboardView } from "./ClipboardView";
import { DocumentScaleLayer } from "./DocumentScaleLayer";
import { NotebookView } from "./NotebookView";
import { NotepadView } from "./NotepadView";

export function DocumentWorkspace() {
  const documents = useDocumentStore((state) => state.documents);
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const selectedElementId = useDocumentStore((state) => state.selectedElementId);
  const clearSelection = useDocumentStore((state) => state.clearSelection);
  const editorZoom = useEditorStore((state) => state.editorZoom);
  const zoomMode = useEditorStore((state) => state.zoomMode);
  const setEditorZoom = useEditorStore((state) => state.setEditorZoom);
  const fitEditorZoom = useEditorStore((state) => state.fitEditorZoom);
  const resetEditorZoom = useEditorStore((state) => state.resetEditorZoom);
  const closeContextMenu = useEditorStore((state) => state.closeContextMenu);
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
  const gestureStageRef = useTouchDocumentGestures({
    geometry,
    scale,
    onZoomCommit: setEditorZoom,
  });

  const clearSelectionFromWorkspace = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (!selectedElementId || !(event.target instanceof Element)) {
      return;
    }

    if (
      event.target.closest(
        ".paper-surface, .page-element-frame, button, input, textarea, select, [role='dialog'], [role='menu']",
      )
    ) {
      return;
    }

    closeContextMenu();
    clearSelection();
  };

  return (
    <main
      className="document-workspace"
      ref={viewportRef}
      onPointerDown={clearSelectionFromWorkspace}
    >
      <div
        ref={gestureStageRef}
        className="editor-document-viewport document-stage"
        aria-label="Área navegável do documento"
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
        <div className="document-status-controls">
          {activeDocument.type !== "notebook" && (
            <PageNavigation
              document={activeDocument}
              pages={activePages}
            />
          )}

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
