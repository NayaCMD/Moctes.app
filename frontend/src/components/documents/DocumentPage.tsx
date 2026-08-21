import { useCallback, useState } from "react";
import { useDocumentStore } from "../../stores/useDocumentStore";
import {
  elementPassesVisibilityFilter,
  useEditorStore,
} from "../../stores/useEditorStore";
import type { Page } from "../../types/page.types";
import { DEFAULT_SAFE_AREA, clamp } from "../../utils/coordinates.utils";
import { createCommentElement, createElementFromTool } from "../../utils/element.utils";
import { elementCenterIntersectsArea, normalizeEraseArea } from "../../utils/eraseArea.utils";
import { placeElementForInsertion } from "../../utils/insertion.utils";
import { SelectionBox } from "../editor/SelectionBox";
import { ElementQuickActions } from "../editor/ElementQuickActions";
import { DrawingPreviewOverlay } from "../editor/DrawingPreviewOverlay";
import { EraseAreaOverlay } from "../editor/EraseAreaOverlay";
import { PageDropIndicator } from "../editor/PageDropIndicator";
import { PageElementRenderer } from "../elements/PageElementRenderer";
import { PaperSurface } from "./PaperSurface";
import { recordComponentRender } from "../../performance/performanceInstrumentation";
import { useAuthStore } from "../../stores/useAuthStore";

interface DocumentPageProps {
  page: Page;
  className: string;
  label: string;
  interactive?: boolean;
}

export function DocumentPage({
  page,
  className,
  label,
  interactive = true,
}: DocumentPageProps) {
  recordComponentRender("DocumentPage");
  const [pageElement, setPageElement] = useState<HTMLElement | null>(null);
  const activeWorkspaceId = useAuthStore((state) => state.activeWorkspaceId);
  const currentUserName = useAuthStore((state) => state.user?.name);
  const workspaceRole = useAuthStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === activeWorkspaceId)
        ?.role,
  );
  const canEdit = interactive && workspaceRole !== "VIEWER";
  const [pendingComment, setPendingComment] = useState<{ x: number; y: number } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [eraseArea, setEraseArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const handleSurfaceRef = useCallback((node: HTMLElement | null) => {
    setPageElement(node);
  }, []);
  const addElement = useDocumentStore((state) => state.addElement);
  const updatePage = useDocumentStore((state) => state.updatePage);
  const setActivePage = useDocumentStore((state) => state.setActivePage);
  const activePageId = useDocumentStore((state) => state.activePageId);
  const selectedElementId = useDocumentStore((state) => state.selectedElementId);
  const clearSelection = useDocumentStore((state) => state.clearSelection);
  const editorMode = useEditorStore((state) => state.editorMode);
  const setEditorMode = useEditorStore((state) => state.setEditorMode);
  const drawingSettings = useEditorStore((state) => state.drawingSettings);
  const ruler = useEditorStore((state) => state.ruler);
  const visibilityFilters = useEditorStore((state) => state.visibilityFilters);
  const editingTextElementId = useEditorStore((state) => state.editingTextElementId);
  const closeContextMenu = useEditorStore((state) => state.closeContextMenu);
  const setDrawingPreview = useEditorStore((state) => state.setDrawingPreview);
  const selectedElement = page.elements.find(
    (element) =>
      element.id === selectedElementId &&
      elementPassesVisibilityFilter(element, visibilityFilters),
  );
  const visibleElements = page.elements
    .filter((element) => elementPassesVisibilityFilter(element, visibilityFilters))
    .slice()
    .sort((first, second) => first.zIndex - second.zIndex);

  return (
    <PaperSurface
      surfaceRef={handleSurfaceRef}
      page={page}
      className={className}
      editorMode={editorMode}
      label={label}
      active={activePageId === page.id}
      onPagePointerDown={(position, event) => {
        if (canEdit && editorMode === "erase-area" && event.button === 0) {
          event.preventDefault();
          closeContextMenu();
          setActivePage(page.id);
          const surface = event.currentTarget;
          const rect = surface.getBoundingClientRect();
          const start = position;
          let latestArea = normalizeEraseArea(start, start);
          setEraseArea(latestArea);
          surface.setPointerCapture(event.pointerId);

          const readPoint = (pointerEvent: PointerEvent) => ({
            x: clamp(((pointerEvent.clientX - rect.left) / rect.width) * 100, 0, 100),
            y: clamp(((pointerEvent.clientY - rect.top) / rect.height) * 100, 0, 100),
          });

          const handleMove = (moveEvent: PointerEvent) => {
            latestArea = normalizeEraseArea(start, readPoint(moveEvent));
            setEraseArea(latestArea);
          };
          const cleanup = () => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
            window.removeEventListener("pointercancel", handleCancel);
          };
          const handleUp = () => {
            cleanup();
            setEraseArea(null);
            if (latestArea.width < 1 || latestArea.height < 1) {
              return;
            }
            const nextElements = page.elements.filter(
              (element) =>
                element.locked ||
                !elementCenterIntersectsArea(
                  {
                    x: element.x,
                    y: element.y,
                    width: element.width,
                    height: element.height,
                  },
                  latestArea,
                ),
            );
            if (nextElements.length !== page.elements.length) {
              updatePage(page.id, { elements: nextElements });
            }
          };
          const handleCancel = () => {
            cleanup();
            setEraseArea(null);
          };
          window.addEventListener("pointermove", handleMove);
          window.addEventListener("pointerup", handleUp);
          window.addEventListener("pointercancel", handleCancel);
          return;
        }

        if (!canEdit || editorMode !== "draw" || event.button !== 0) {
          return;
        }
        event.preventDefault();
        closeContextMenu();
        setActivePage(page.id);
        const surface = event.currentTarget;
        const rect = surface.getBoundingClientRect();
        const points = [position];
        const previewBase = {
          pageId: page.id,
          color: drawingSettings.color,
          width: drawingSettings.strokeWidth,
          opacity: drawingSettings.opacity,
          guided: ruler.visible,
        };
        setDrawingPreview({ ...previewBase, points });
        surface.setPointerCapture(event.pointerId);

        const readPoint = (pointerEvent: PointerEvent) => ({
          x: clamp(((pointerEvent.clientX - rect.left) / rect.width) * 100, 0, 100),
          y: clamp(((pointerEvent.clientY - rect.top) / rect.height) * 100, 0, 100),
        });

        const handleMove = (moveEvent: PointerEvent) => {
          points.push(readPoint(moveEvent));
          const previewPoints = ruler.visible ? [points[0], points.at(-1) ?? points[0]] : [...points];
          setDrawingPreview({ ...previewBase, points: previewPoints });
        };

        const handleUp = () => {
          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleUp);
          window.removeEventListener("pointercancel", handleCancel);
          setDrawingPreview(null);
          if (points.length < 2) {
            return;
          }

          const drawingPoints = ruler.visible ? [points[0], points.at(-1) ?? points[0]] : points;
          const element = {
            id: `el-${crypto.randomUUID()}`,
            type: "drawing" as const,
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            rotation: 0,
            zIndex: 10,
            locked: false,
            hidden: false,
            content: {
              kind: "drawing" as const,
              paths: [
                {
                  id: `path-${crypto.randomUUID()}`,
                  points: drawingPoints,
                  color: drawingSettings.color,
                  width: drawingSettings.strokeWidth,
                  opacity: drawingSettings.opacity,
                },
              ],
            },
            style: {},
          };
          addElement(page.id, element);
        };

        const handleCancel = () => {
          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleUp);
          window.removeEventListener("pointercancel", handleCancel);
          setDrawingPreview(null);
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
        window.addEventListener("pointercancel", handleCancel);
      }}
      onPageClick={(position, event) => {
        if (!canEdit) {
          return;
        }

        closeContextMenu();
        setActivePage(page.id);
        const editorState = useEditorStore.getState();
        if (
          editorState.interaction.mode !== "idle" ||
          editorState.assetDrag.status === "dragging" ||
          editingTextElementId
        ) {
          if (editingTextElementId) {
            clearSelection();
          }
          return;
        }

        if (selectedElementId) {
          clearSelection();
          return;
        }

        if (editorMode === "comment") {
          setPendingComment(position);
          setCommentText("");
          clearSelection();
          return;
        }

        if (editorMode !== "text" && editorMode !== "checklist") {
          clearSelection();
          return;
        }

        const insertionTool = editorMode === "checklist" ? "checklist" : "text";
        const element = createElementFromTool(insertionTool, position);
        if (element) {
          if (event.detail > 1) {
            return;
          }
          const placedElement = placeElementForInsertion({
            element,
            existingElements: page.elements,
            preferredPosition: position,
            safeArea: DEFAULT_SAFE_AREA,
          });
          addElement(page.id, placedElement);
          setEditorMode("select");
          if (insertionTool === "checklist") {
            useEditorStore.getState().setEditingTextElementId(placedElement.id);
          }
          return;
        }

        clearSelection();
      }}
    >
      {visibleElements.map((element) => (
        <PageElementRenderer
          key={element.id}
          element={element}
          interactive={canEdit}
          pageElement={pageElement}
          pageId={page.id}
        />
      ))}
      {canEdit && selectedElement && pageElement && (
        <>
          <SelectionBox element={selectedElement} pageElement={pageElement} />
          <ElementQuickActions
            element={selectedElement}
            elements={page.elements}
            pageElement={pageElement}
          />
        </>
      )}
      {canEdit && <PageDropIndicator pageId={page.id} pageElement={pageElement} />}
      {canEdit && <DrawingPreviewOverlay pageId={page.id} />}
      {canEdit && <EraseAreaOverlay area={eraseArea} />}
      {canEdit && pendingComment && (
        <form
          className="comment-composer"
          style={{ left: `${pendingComment.x}%`, top: `${pendingComment.y}%` }}
          onSubmit={(event) => {
            event.preventDefault();
            const text = commentText.trim();
            if (!text) {
              setPendingComment(null);
              return;
            }
            const element = placeElementForInsertion({
              element: createCommentElement({
                x: pendingComment.x,
                y: pendingComment.y,
                text,
                authorLabel: currentUserName,
              }),
              existingElements: page.elements,
              preferredPosition: pendingComment,
              safeArea: DEFAULT_SAFE_AREA,
            });
            addElement(page.id, element);
            setPendingComment(null);
            setCommentText("");
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <label>
            <span className="sr-only">Comentario</span>
            <input
              autoFocus
              value={commentText}
              placeholder="Comentario"
              onChange={(event) => setCommentText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setPendingComment(null);
                }
              }}
            />
          </label>
          <button type="submit">OK</button>
          <button type="button" onClick={() => setPendingComment(null)}>
            Cancelar
          </button>
        </form>
      )}
    </PaperSurface>
  );
}
