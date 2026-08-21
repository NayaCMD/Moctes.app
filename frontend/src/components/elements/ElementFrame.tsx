import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type { PageElement } from "../../types/element.types";
import { DEFAULT_SAFE_AREA, keepBoundsInsidePage, pointerToPagePercent } from "../../utils/coordinates.utils";
import { getPageDropTargetFromPoint } from "../../utils/assetDrop.utils";
import { moveBounds } from "../../utils/elementBounds.utils";
import { recordComponentRender } from "../../performance/performanceInstrumentation";
import { useCollaborationStore } from "../../stores/useCollaborationStore";

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
  recordComponentRender("ElementFrame");
  const selected = useDocumentStore(
    (state) => state.selectedElementId === element.id,
  );
  const setActivePage = useDocumentStore((state) => state.setActivePage);
  const selectElement = useDocumentStore((state) => state.selectElement);
  const updateElement = useDocumentStore((state) => state.updateElement);
  const deleteElement = useDocumentStore((state) => state.deleteElement);
  const moveElementToPage = useDocumentStore((state) => state.moveElementToPage);
  const beginInteraction = useEditorStore((state) => state.beginInteraction);
  const updatePreview = useEditorStore((state) => state.updatePreview);
  const endInteraction = useEditorStore((state) => state.endInteraction);
  const preview = useEditorStore((state) =>
    state.interaction.elementId === element.id
      ? state.interaction.preview
      : null,
  );
  const interactionMode = useEditorStore((state) =>
    state.interaction.elementId === element.id ? state.interaction.mode : "idle",
  );
  const editorMode = useEditorStore((state) => state.editorMode);
  const setTransferPreview = useEditorStore((state) => state.setTransferPreview);
  const openContextMenu = useEditorStore((state) => state.openContextMenu);
  const closeContextMenu = useEditorStore((state) => state.closeContextMenu);
  const remotePreview = useCollaborationStore(
    (state) => state.elementPreviews[element.id]?.preview ?? null,
  );
  const current = { ...element, ...remotePreview, ...preview };
  const style = {
    left: `${current.x}%`,
    top: `${current.y}%`,
    width: `${current.width}%`,
    height: `${current.height}%`,
    zIndex:
      interactionMode === "dragging"
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
    closeContextMenu();
    setActivePage(pageId);
    selectElement(element.id);

    if (editorMode === "erase") {
      event.preventDefault();
      if (!element.locked) {
        deleteElement(element.id);
      }
      return;
    }

    if (event.pointerType === "touch" && !selected) {
      return;
    }

    if (!pageElement || element.locked || event.button !== 0) {
      return;
    }

    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Window listeners still track the gesture when synthetic or legacy
      // pointer sources do not support capture.
    }
    const pageRect = pageElement.getBoundingClientRect();
    const activePointerId = event.pointerId;
    const touchDragThreshold = event.pointerType === "touch" ? 8 : 2;
    const initialClientPoint = { x: event.clientX, y: event.clientY };
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
    let interruptedByPinch = false;
    let latestSourceBounds: Partial<PageElement> | null = null;
    let transferTarget: { pageId: string; x: number; y: number } | null = null;

    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== activePointerId || interruptedByPinch) {
        return;
      }
      if (
        !moved &&
        Math.hypot(
          moveEvent.clientX - initialClientPoint.x,
          moveEvent.clientY - initialClientPoint.y,
        ) < touchDragThreshold
      ) {
        return;
      }
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

    const removeListeners = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      window.removeEventListener("moctes:pinchstart", handlePinchStart);
    };

    const handleUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== activePointerId) return;
      removeListeners();
      if (!interruptedByPinch && moved && transferTarget) {
        moveElementToPage({
          elementId: element.id,
          sourcePageId: pageId,
          targetPageId: transferTarget.pageId,
          x: transferTarget.x,
          y: transferTarget.y,
        });
      } else if (!interruptedByPinch && moved && latestSourceBounds) {
        updateElement(element.id, latestSourceBounds);
      }
      endInteraction();
    };

    const handleCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== activePointerId) return;
      removeListeners();
      endInteraction();
    };

    const handlePinchStart = () => {
      interruptedByPinch = true;
      endInteraction();
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    window.addEventListener("moctes:pinchstart", handlePinchStart);
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
      data-element-id={element.id}
      style={style}
      aria-label={interactive ? `Selecionar elemento ${element.type}` : undefined}
      onPointerDown={startDrag}
      onContextMenu={(event) => {
        if (!interactive) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setActivePage(pageId);
        selectElement(element.id);
        openContextMenu(element.id, event.clientX, event.clientY);
      }}
      onDoubleClick={(event) => {
        if (!interactive) {
          return;
        }
        event.stopPropagation();
        if (
          (element.type === "text" ||
            element.type === "post-it" ||
            element.type === "checklist") &&
          !element.locked
        ) {
          event.preventDefault();
          useEditorStore.getState().setEditingTextElementId(element.id);
        }
      }}
    >
      {children}
    </div>
  );
}
