import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useDocumentStore } from "../stores/useDocumentStore";
import { useEditorStore } from "../stores/useEditorStore";
import type { EmojiCatalogItem } from "../types/emoji.types";
import { getPageDropTargetFromPoint } from "../utils/assetDrop.utils";
import { DEFAULT_SAFE_AREA } from "../utils/coordinates.utils";
import { createEmojiElementFromDrop } from "../utils/emoji.utils";

const DRAG_START_THRESHOLD = 4;

interface PendingPointer {
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
}

export function useEmojiDrag(
  item: EmojiCatalogItem,
  onAdded?: (item: EmojiCatalogItem) => void,
) {
  const pending = useRef<PendingPointer | null>(null);
  const suppressNextClick = useRef(false);

  const clearDrag = () => {
    pending.current = null;
    document.body.classList.remove("asset-dragging", "emoji-dragging");
  };

  const cancelDrag = () => {
    useEditorStore.getState().cancelAssetDrag();
    clearDrag();
  };

  const readTarget = (clientX: number, clientY: number) => {
    const editorState = useEditorStore.getState();
    const documentState = useDocumentStore.getState();
    const target = getPageDropTargetFromPoint(clientX, clientY);
    const documentModel = target
      ? documentState.documents.find((document) => document.id === target.documentId)
      : undefined;
    const page = documentModel?.pages.find((candidate) => candidate.id === target?.pageId);
    const validDrop = Boolean(
      target &&
        page &&
        editorState.interaction.mode === "idle" &&
        editorState.editingTextElementId === null &&
        editorState.notebookTransition === null,
    );
    return { target, page, validDrop };
  };

  const updateTarget = (clientX: number, clientY: number) => {
    const editorState = useEditorStore.getState();
    const { target, validDrop } = readTarget(clientX, clientY);
    editorState.updateAssetDragPointer(clientX, clientY);
    editorState.setAssetDragTarget({
      targetPageId: validDrop && target ? target.pageId : null,
      targetDocumentId: validDrop && target ? target.documentId : null,
      validDrop,
    });
  };

  const commitDrop = (clientX: number, clientY: number) => {
    const documentState = useDocumentStore.getState();
    const editorState = useEditorStore.getState();
    const { target, page, validDrop } = readTarget(clientX, clientY);
    if (!target || !page || !validDrop || !editorState.assetDrag.validDrop) {
      cancelDrag();
      return;
    }

    const element = createEmojiElementFromDrop({
      item,
      clientX,
      clientY,
      pageRect: target.rect,
      existingElements: page.elements,
      safeArea: DEFAULT_SAFE_AREA,
    });
    documentState.setActivePage(page.id);
    useDocumentStore.getState().addElement(page.id, element);
    onAdded?.(item);
    editorState.cancelAssetDrag();
    clearDrag();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    pending.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);

    const handleMove = (moveEvent: PointerEvent) => {
      const active = pending.current;
      if (!active || active.pointerId !== moveEvent.pointerId) {
        return;
      }
      const distance = Math.hypot(
        moveEvent.clientX - active.startX,
        moveEvent.clientY - active.startY,
      );
      if (!active.dragging && distance < DRAG_START_THRESHOLD) {
        return;
      }
      moveEvent.preventDefault();
      if (!active.dragging) {
        active.dragging = true;
        suppressNextClick.current = true;
        document.body.classList.add("asset-dragging", "emoji-dragging");
        useEditorStore.getState().beginAssetDrag({
          assetId: item.id,
          assetType: "emoji",
          sourceCategory: null,
          previewSrc: null,
          previewText: item.emoji,
          previewAlt: item.name,
          pointerX: moveEvent.clientX,
          pointerY: moveEvent.clientY,
        });
      }
      updateTarget(moveEvent.clientX, moveEvent.clientY);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
    };
    const handleUp = (upEvent: PointerEvent) => {
      cleanup();
      if (pending.current?.dragging) {
        upEvent.preventDefault();
        commitDrop(upEvent.clientX, upEvent.clientY);
      } else {
        clearDrag();
      }
    };
    const handleCancel = () => {
      cleanup();
      cancelDrag();
    };

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
  };

  const shouldSuppressClick = () => {
    if (!suppressNextClick.current) {
      return false;
    }
    suppressNextClick.current = false;
    return true;
  };

  return { onPointerDown, shouldSuppressClick };
}
