import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useAppStore } from "../stores/useAppStore";
import { useDocumentStore } from "../stores/useDocumentStore";
import { useEditorStore } from "../stores/useEditorStore";
import type { SidebarAsset } from "../types/document.types";
import {
    createElementFromAssetDrop,
    getElementTypeFromAsset,
    getPageDropTargetFromPoint,
} from "../utils/assetDrop.utils";
import { DEFAULT_SAFE_AREA } from "../utils/coordinates.utils";
import { getEditableActivePage } from "../utils/document.utils";

const DRAG_START_THRESHOLD = 4;

interface UseAssetDragOptions {
    asset: SidebarAsset;
    previewSrc?: string | null;
    onSelect: (assetId: string) => void;
    onAdded?: (assetId: string) => void;
}

interface PendingPointer {
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
}

export function useAssetDrag({ asset, previewSrc, onSelect, onAdded }: UseAssetDragOptions) {
    const pending = useRef<PendingPointer | null>(null);
    const suppressNextClick = useRef(false);

    const clearDrag = () => {
        pending.current = null;
        document.body.classList.remove("asset-dragging");
    };

    const cancelDrag = () => {
        useEditorStore.getState().cancelAssetDrag();
        clearDrag();
    };

    const updateTarget = (clientX: number, clientY: number) => {
        const editorState = useEditorStore.getState();
        const documentState = useDocumentStore.getState();
        const target = getPageDropTargetFromPoint(clientX, clientY);
        const document = target
            ? documentState.documents.find((item) => item.id === target.documentId)
            : undefined;
        const page = document
            ? getEditableActivePage(document, {
                notebookBook: editorState.notebookBook,
                notebookTransition: editorState.notebookTransition,
            })
            : undefined;
        const validDrop =
            Boolean(target && page && page.id === target.pageId) &&
            editorState.interaction.mode === "idle" &&
            editorState.editingTextElementId === null;

        editorState.updateAssetDragPointer(clientX, clientY);
        editorState.setAssetDragTarget({
            targetPageId: validDrop && target ? target.pageId : null,
            targetDocumentId: validDrop && target ? target.documentId : null,
            validDrop,
        });
    };

    const commitDrop = (clientX: number, clientY: number) => {
        const editorState = useEditorStore.getState();
        const documentState = useDocumentStore.getState();
        const target = getPageDropTargetFromPoint(clientX, clientY);
        if (!target || !editorState.assetDrag.validDrop) {
            cancelDrag();
            return;
        }

        const document = documentState.documents.find((item) => item.id === target.documentId);
        const page = document
            ? getEditableActivePage(document, {
                notebookBook: editorState.notebookBook,
                notebookTransition: editorState.notebookTransition,
            })
            : undefined;
        if (!page || page.id !== target.pageId) {
            cancelDrag();
            return;
        }

        const element = createElementFromAssetDrop({
            asset,
            clientX,
            clientY,
            pageRect: target.rect,
            existingElements: page.elements,
            safeArea: DEFAULT_SAFE_AREA,
        });

        editorState.recordHistory(documentState.documents);
        documentState.setActivePage(page.id);
        useDocumentStore.getState().addElement(page.id, element);
        useAppStore.getState().setSelectedAssetId(asset.id);
        onAdded?.(asset.id);
        editorState.cancelAssetDrag();
        clearDrag();
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0) {
            return;
        }

        pending.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            dragging: false,
        };
        onSelect(asset.id);
        event.currentTarget.setPointerCapture(event.pointerId);

        const handleMove = (moveEvent: PointerEvent) => {
            const active = pending.current;
            if (!active || active.pointerId !== moveEvent.pointerId) {
                return;
            }

            const distance = Math.hypot(moveEvent.clientX - active.startX, moveEvent.clientY - active.startY);
            if (!active.dragging && distance < DRAG_START_THRESHOLD) {
                return;
            }

            moveEvent.preventDefault();
            if (!active.dragging) {
                active.dragging = true;
                suppressNextClick.current = true;
                document.body.classList.add("asset-dragging");
                useEditorStore.getState().beginAssetDrag({
                    assetId: asset.id,
                    assetType: getElementTypeFromAsset(asset),
                    sourceCategory: asset.category,
                    previewSrc: previewSrc ?? asset.src,
                    previewAlt: asset.label,
                    pointerX: moveEvent.clientX,
                    pointerY: moveEvent.clientY,
                });
            }
            updateTarget(moveEvent.clientX, moveEvent.clientY);
        };

        const handleUp = (upEvent: PointerEvent) => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
            window.removeEventListener("pointercancel", handleCancel);
            if (pending.current?.dragging) {
                upEvent.preventDefault();
                commitDrop(upEvent.clientX, upEvent.clientY);
            } else {
                clearDrag();
            }
        };

        const handleCancel = () => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
            window.removeEventListener("pointercancel", handleCancel);
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

    return {
        onPointerDown: handlePointerDown,
        shouldSuppressClick,
    };
}
