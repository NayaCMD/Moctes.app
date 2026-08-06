import { useEffect } from "react";
import { EDITOR_ZOOM_STEP } from "../config/documentGeometry";
import { useDocumentStore } from "../stores/useDocumentStore";
import { useEditorStore } from "../stores/useEditorStore";
import type { PageElement } from "../types/element.types";
import { DEFAULT_SAFE_AREA } from "../utils/coordinates.utils";
import { getEditableActivePage } from "../utils/document.utils";
import { nudgeBounds } from "../utils/elementBounds.utils";
import { isEditableTarget, isModKey } from "../utils/keyboard.utils";

function findPageElement(pageElements: PageElement[], elementId: string | null): PageElement | null {
    if (!elementId) {
        return null;
    }

    return pageElements.find((element) => element.id === elementId) ?? null;
}

export function useEditorKeyboardShortcuts() {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const documentState = useDocumentStore.getState();
            const editorState = useEditorStore.getState();
            const activeDocument = documentState.documents.find(
                (document) => document.id === documentState.activeDocumentId,
            );
            const editableActivePage = activeDocument ? getEditableActivePage(activeDocument) : undefined;
            const selectedElement = editableActivePage
                ? findPageElement(editableActivePage.elements, documentState.selectedElementId)
                : null;
            const modKey = isModKey(event);

            if (isEditableTarget(event.target)) {
                if (event.key === "Escape") {
                    useEditorStore.getState().setEditingTextElementId(null);
                }
                return;
            }

            if (event.key === "Escape") {
                event.preventDefault();
                editorState.cancelAssetDrag();
                editorState.closeContextMenu();
                editorState.endInteraction();
                editorState.setActiveToolPanel(null);
                editorState.setEditorMode("select");
                editorState.setRuler({ visible: false });
                documentState.clearSelection();
                return;
            }

            if (modKey && event.key.toLowerCase() === "z") {
                event.preventDefault();
                const next = event.shiftKey
                    ? editorState.redo(documentState.documents)
                    : editorState.undo(documentState.documents);
                if (next) {
                    documentState.applyDocumentsSnapshot(next);
                }
                return;
            }

            if (modKey && event.key.toLowerCase() === "y") {
                event.preventDefault();
                const next = editorState.redo(documentState.documents);
                if (next) {
                    documentState.applyDocumentsSnapshot(next);
                }
                return;
            }

            if (modKey && (event.key === "+" || event.key === "=")) {
                event.preventDefault();
                editorState.setEditorZoom(editorState.editorZoom + EDITOR_ZOOM_STEP);
                return;
            }

            if (modKey && event.key === "-") {
                event.preventDefault();
                editorState.setEditorZoom(editorState.editorZoom - EDITOR_ZOOM_STEP);
                return;
            }

            if (modKey && event.key === "0") {
                event.preventDefault();
                editorState.resetEditorZoom();
                return;
            }

            if (modKey && event.key.toLowerCase() === "c" && selectedElement) {
                event.preventDefault();
                editorState.setClipboardElement(selectedElement);
                return;
            }

            if (modKey && event.key.toLowerCase() === "x" && selectedElement && !selectedElement.locked) {
                event.preventDefault();
                editorState.recordHistory(documentState.documents);
                editorState.setClipboardElement(selectedElement);
                documentState.deleteElement(selectedElement.id);
                return;
            }

            if (modKey && event.key.toLowerCase() === "v" && editorState.clipboardElement && editableActivePage) {
                event.preventDefault();
                editorState.recordHistory(documentState.documents);
                const pastedId = documentState.pasteElement(editableActivePage.id, editorState.clipboardElement);
                editorState.incrementPasteCount();
                documentState.selectElement(pastedId);
                return;
            }

            if (modKey && event.key.toLowerCase() === "d" && selectedElement && !selectedElement.locked) {
                event.preventDefault();
                editorState.recordHistory(documentState.documents);
                documentState.duplicateElement(selectedElement.id);
                return;
            }

            if ((event.key === "Delete" || event.key === "Backspace") && selectedElement && !selectedElement.locked) {
                event.preventDefault();
                editorState.recordHistory(documentState.documents);
                documentState.deleteElement(selectedElement.id);
                return;
            }

            if (
                selectedElement &&
                !selectedElement.locked &&
                ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key)
            ) {
                event.preventDefault();
                const step = event.shiftKey ? 2 : 0.5;
                const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
                const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
                editorState.recordHistory(documentState.documents);
                documentState.updateElement(
                    selectedElement.id,
                    nudgeBounds(selectedElement, dx, dy, DEFAULT_SAFE_AREA, selectedElement.rotation),
                );
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);
}
