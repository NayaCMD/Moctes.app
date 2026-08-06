import { Copy, EyeOff, Layers, Lock, Scissors, Trash2, Unlock } from "lucide-react";
import { useEffect, useLayoutEffect } from "react";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type { PageElement } from "../../types/element.types";
import { useClickOutside } from "../../hooks/useClickOutside";
import { getEditableActivePage } from "../../utils/document.utils";

function findElement(elements: PageElement[], elementId: string | null): PageElement | null {
  return elements.find((element) => element.id === elementId) ?? null;
}

export function ElementContextMenu() {
  const documents = useDocumentStore((state) => state.documents);
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const duplicateElement = useDocumentStore((state) => state.duplicateElement);
  const deleteElement = useDocumentStore((state) => state.deleteElement);
  const pasteElement = useDocumentStore((state) => state.pasteElement);
  const toggleElementLock = useDocumentStore((state) => state.toggleElementLock);
  const toggleElementVisibility = useDocumentStore((state) => state.toggleElementVisibility);
  const bringElementToFront = useDocumentStore((state) => state.bringElementToFront);
  const sendElementToBack = useDocumentStore((state) => state.sendElementToBack);
  const moveElementForward = useDocumentStore((state) => state.moveElementForward);
  const moveElementBackward = useDocumentStore((state) => state.moveElementBackward);
  const selectElement = useDocumentStore((state) => state.selectElement);
  const contextMenu = useEditorStore((state) => state.contextMenu);
  const closeContextMenu = useEditorStore((state) => state.closeContextMenu);
  const repositionContextMenu = useEditorStore((state) => state.repositionContextMenu);
  const clipboardElement = useEditorStore((state) => state.clipboardElement);
  const setClipboardElement = useEditorStore((state) => state.setClipboardElement);
  const incrementPasteCount = useEditorStore((state) => state.incrementPasteCount);
  const recordHistory = useEditorStore((state) => state.recordHistory);
  const notebookTransition = useEditorStore((state) => state.notebookTransition);
  const menuRef = useClickOutside<HTMLDivElement>(() => closeContextMenu(), contextMenu.open);
  const activeDocument = documents.find((document) => document.id === activeDocumentId);
  const activePage = activeDocument
    ? getEditableActivePage(activeDocument, { notebookTransition })
    : undefined;
  const element = findElement(activePage?.elements ?? [], contextMenu.elementId);

  useEffect(() => {
    if (!contextMenu.open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeContextMenu, contextMenu.open]);

  useLayoutEffect(() => {
    if (!contextMenu.open || !menuRef.current) {
      return;
    }

    const rect = menuRef.current.getBoundingClientRect();
    repositionContextMenu(rect.width, rect.height);
  }, [contextMenu.open, menuRef, repositionContextMenu]);

  if (!contextMenu.open || !element) {
    return null;
  }

  const run = (action: () => void, shouldRecord = true) => {
    if (shouldRecord) {
      recordHistory(documents);
    }
    action();
    closeContextMenu();
  };

  return (
    <div
      ref={menuRef}
      className="element-context-menu"
      role="menu"
      aria-label="Menu do elemento"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <button
        type="button"
        role="menuitem"
        disabled={element.locked}
        onClick={() => run(() => duplicateElement(element.id))}
      >
        <Copy size={14} /> Duplicar
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setClipboardElement(element);
          closeContextMenu();
        }}
      >
        <Copy size={14} /> Copiar
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={element.locked}
        onClick={() => run(() => {
          setClipboardElement(element);
          deleteElement(element.id);
        })}
      >
        <Scissors size={14} /> Recortar
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!clipboardElement}
        onClick={() => run(() => {
          if (clipboardElement) {
            const pastedId = activePage ? pasteElement(activePage.id, clipboardElement) : null;
            incrementPasteCount();
            if (pastedId) {
              selectElement(pastedId);
            }
          }
        })}
      >
        <Copy size={14} /> Colar
      </button>
      <hr />
      <button
        type="button"
        role="menuitem"
        disabled={element.locked}
        onClick={() => run(() => bringElementToFront(element.id))}
      >
        <Layers size={14} /> Trazer para frente
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={element.locked}
        onClick={() => run(() => moveElementForward(element.id))}
      >
        <Layers size={14} /> Avançar camada
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={element.locked}
        onClick={() => run(() => moveElementBackward(element.id))}
      >
        <Layers size={14} /> Recuar camada
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={element.locked}
        onClick={() => run(() => sendElementToBack(element.id))}
      >
        <Layers size={14} /> Enviar para trás
      </button>
      <hr />
      <button type="button" role="menuitem" onClick={() => run(() => toggleElementLock(element.id))}>
        {element.locked ? <Unlock size={14} /> : <Lock size={14} />}
        {element.locked ? "Desbloquear" : "Bloquear"}
      </button>
      <button type="button" role="menuitem" onClick={() => run(() => toggleElementVisibility(element.id))}>
        <EyeOff size={14} /> Ocultar
      </button>
      <button
        type="button"
        role="menuitem"
        className="danger"
        disabled={element.locked}
        onClick={() => run(() => deleteElement(element.id))}
      >
        <Trash2 size={14} /> Excluir
      </button>
    </div>
  );
}
