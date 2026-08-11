import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type { PageElement } from "../../types/element.types";
import { DEFAULT_SAFE_AREA, keepBoundsInsidePage, pointerToPagePercent } from "../../utils/coordinates.utils";
import { getPageDropTargetFromPoint } from "../../utils/assetDrop.utils";
import { moveBounds } from "../../utils/elementBounds.utils";

interface ElementFrameProps {
  element: PageElement;
  pageId: string;
  pageElement: HTMLElement | null;
  interactive?: boolean;
  children: ReactNode;
}

export function ElementFrame({
  element,
  pageId,
  pageElement,
  interactive = true,
  children,
}: ElementFrameProps) {
  const documents = useDocumentStore((state) => state.documents);
  const selectedElementId = useDocumentStore((state) => state.selectedElementId);
  const selectElement = useDocumentStore((state) => state.selectElement);
  const updateElement = useDocumentStore((state) => state.updateElement);
  const deleteElement = useDocumentStore((state) => state.deleteElement);
  const moveElementToPage = useDocumentStore((state) => state.moveElementToPage);
  const beginInteraction = useEditorStore((state) => state.beginInteraction);
  const updatePreview = useEditorStore((state) => state.updatePreview);
  const endInteraction = useEditorStore((state) => state.endInteraction);
  const recordHistory = useEditorStore((state) => state.recordHistory);
  const interaction = useEditorStore((state) => state.interaction);
  const editorMode = useEditorStore((state) => state.editorMode);
  const setTransferPreview = useEditorStore((state) => state.setTransferPreview);
  const openContextMenu = useEditorStore((state) => state.openContextMenu);
  const selected = selectedElementId === element.id;
  const preview = interaction.elementId === element.id ? interaction.preview : null;
  const current = { ...element, ...preview };
  const style = {
    left: `${current.x}%`,
    top: `${current.y}%`,
    width: `${current.width}%`,
    height: `${current.height}%`,
    zIndex:
      interaction.elementId === element.id && interaction.mode === "dragging"
        ? 1000
        : element.zIndex,
    transform: `rotate(${current.rotation}deg)`,
    "--element-rotation": `${current.rotation}deg`,
  } as CSSProperties;

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!interactive) {
      return;
    }
    selectElement(element.id);

    if (editorMode === "erase") {
      event.preventDefault();
      if (!element.locked) {
        recordHistory(documents);
        deleteElement(element.id);
      }
      return;
    }

    if (!pageElement || element.locked || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const pageRect = pageElement.getBoundingClientRect();
    const initialPointer = pointerToPagePercent(event.nativeEvent, pageRect);
    const pointerOffset = {
      x: initialPointer.x - element.x,
      y: initialPointer.y - element.y,
    };
    const initial = {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    };
    let moved = false;
    let latestSourceBounds: Partial<PageElement> | null = null;
    let transferTarget: { pageId: string; x: number; y: number } | null = null;

    const handleMove = (moveEvent: PointerEvent) => {
      const target = getPageDropTargetFromPoint(moveEvent.clientX, moveEvent.clientY);
      const currentPointer = target?.pageId === pageId
        ? pointerToPagePercent(moveEvent, pageRect)
        : pointerToPagePercent(moveEvent, target?.rect ?? pageRect);
      const next =
        target?.pageId && target.pageId !== pageId
          ? keepBoundsInsidePage(
              {
                x: currentPointer.x - pointerOffset.x,
                y: currentPointer.y - pointerOffset.y,
                width: element.width,
                height: element.height,
              },
              DEFAULT_SAFE_AREA,
            )
          : moveBounds(
              initial,
              initialPointer,
              currentPointer,
              DEFAULT_SAFE_AREA,
              element.rotation,
            );
      const hasMoved =
        Math.abs(next.x - initial.x) > 0.1 || Math.abs(next.y - initial.y) > 0.1;
      if (!hasMoved && !moved) {
        return;
      }
      if (!moved) {
        beginInteraction({ mode: "dragging", elementId: element.id, preview: {} });
        moved = true;
      }
      if (target?.pageId && target.pageId !== pageId) {
        transferTarget = { pageId: target.pageId, x: next.x, y: next.y };
        latestSourceBounds = null;
        setTransferPreview({
          elementId: element.id,
          sourcePageId: pageId,
          targetPageId: target.pageId,
          x: next.x,
          y: next.y,
          validTarget: true,
        });
      } else if (target?.pageId === pageId) {
        transferTarget = null;
        latestSourceBounds = next;
        setTransferPreview({
          elementId: element.id,
          sourcePageId: pageId,
          targetPageId: target?.pageId ?? null,
          x: next.x,
          y: next.y,
          validTarget: target?.pageId === pageId,
        });
      } else {
        transferTarget = null;
        latestSourceBounds = null;
        setTransferPreview({
          elementId: element.id,
          sourcePageId: pageId,
          targetPageId: null,
          x: initial.x,
          y: initial.y,
          validTarget: false,
        });
      }
      updatePreview(next);
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      if (moved && transferTarget) {
        recordHistory(useDocumentStore.getState().documents);
        moveElementToPage({
          elementId: element.id,
          sourcePageId: pageId,
          targetPageId: transferTarget.pageId,
          x: transferTarget.x,
          y: transferTarget.y,
        });
      } else if (moved && latestSourceBounds) {
        recordHistory(useDocumentStore.getState().documents);
        updateElement(element.id, latestSourceBounds);
      }
      endInteraction();
    };

    const handleCancel = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      endInteraction();
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
  };

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      className="page-element-frame"
      data-selected={selected}
      data-locked={element.locked}
      data-hidden={element.hidden}
      data-eraser-active={editorMode === "erase"}
      data-readonly={!interactive}
      style={style}
      aria-label={interactive ? `Selecionar elemento ${element.type}` : undefined}
      onPointerDown={startDrag}
      onContextMenu={(event) => {
        if (!interactive) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        selectElement(element.id);
        openContextMenu(element.id, event.clientX, event.clientY);
      }}
      onDoubleClick={(event) => {
        if (!interactive) {
          return;
        }
        event.stopPropagation();
        if ((element.type === "text" || element.type === "post-it") && !element.locked) {
          event.preventDefault();
          useEditorStore.getState().setEditingTextElementId(element.id);
        }
      }}
    >
      {children}
    </div>
  );
}
