import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  EyeOff,
  Lock,
  Scissors,
  Trash2,
  Unlock,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type { PageElement } from "../../types/element.types";
import { getEditableActivePage } from "../../utils/document.utils";

function findElement(elements: PageElement[], elementId: string | null): PageElement | null {
  return elements.find((element) => element.id === elementId) ?? null;
}

export function ElementContextMenu() {
  const documents = useDocumentStore((state) => state.documents);
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const selectedElementId = useDocumentStore((state) => state.selectedElementId);
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
  const notebookTransition = useEditorStore((state) => state.notebookTransition);
  const notebookBook = useEditorStore((state) => state.notebookBook);
  const menuRef = useClickOutside<HTMLDivElement>(() => closeContextMenu(), contextMenu.open);
  const activeDocument = documents.find((document) => document.id === activeDocumentId);
  const activePage = activeDocument
    ? getEditableActivePage(activeDocument, { notebookBook, notebookTransition })
    : undefined;
  const element = findElement(activePage?.elements ?? [], contextMenu.elementId);

  useEffect(() => {
    if (!contextMenu.open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeContextMenu();
        document
          .querySelector<HTMLButtonElement>("[aria-controls='element-context-menu']")
          ?.focus({ preventScroll: true });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeContextMenu, contextMenu.open]);

  useEffect(() => {
    if (contextMenu.open && contextMenu.elementId !== selectedElementId) {
      closeContextMenu();
    }
  }, [closeContextMenu, contextMenu.elementId, contextMenu.open, selectedElementId]);

  useEffect(() => {
    if (!contextMenu.open) return;
    menuRef.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus({ preventScroll: true });
  }, [contextMenu.elementId, contextMenu.open, menuRef]);

  useLayoutEffect(() => {
    if (!contextMenu.open || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    repositionContextMenu(rect.width, rect.height);
  }, [contextMenu.open, menuRef, repositionContextMenu]);

  if (!contextMenu.open || !element) return null;

  const run = (action: () => void) => {
    action();
    closeContextMenu();
  };

  const stopEditorEvent = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
    );
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex =
      event.key === "ArrowDown"
        ? (currentIndex + 1) % items.length
        : event.key === "ArrowUp"
          ? (currentIndex - 1 + items.length) % items.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : -1;

    if (nextIndex >= 0 && items[nextIndex]) {
      event.preventDefault();
      items[nextIndex].focus();
    }
  };

  return createPortal(
    <div
      id="element-context-menu"
      ref={menuRef}
      className="element-context-menu"
      role="menu"
      aria-label="Menu do elemento"
      aria-orientation="vertical"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onPointerDown={stopEditorEvent}
      onPointerUp={stopEditorEvent}
      onClick={stopEditorEvent}
      onDoubleClick={stopEditorEvent}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDown={handleMenuKeyDown}
    >
      <button
        type="button"
        role="menuitem"
        disabled={element.locked}
        onClick={() => run(() => duplicateElement(element.id))}
      >
        <Copy size={14} aria-hidden="true" /> Duplicar
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setClipboardElement(element);
          closeContextMenu();
        }}
      >
        <Copy size={14} aria-hidden="true" /> Copiar
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={element.locked}
        onClick={() =>
          run(() => {
            setClipboardElement(element);
            deleteElement(element.id);
          })
        }
      >
        <Scissors size={14} aria-hidden="true" /> Recortar
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!clipboardElement}
        onClick={() =>
          run(() => {
            if (!clipboardElement || !activePage) return;
            const pastedId = pasteElement(activePage.id, clipboardElement);
            incrementPasteCount();
            selectElement(pastedId);
          })
        }
      >
        <Copy size={14} aria-hidden="true" /> Colar
      </button>
      <hr />
      <button
        type="button"
        role="menuitem"
        disabled={element.locked}
        onClick={() => run(() => bringElementToFront(element.id))}
      >
        <ChevronsUp size={14} aria-hidden="true" /> Trazer para frente
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={element.locked}
        onClick={() => run(() => moveElementForward(element.id))}
      >
        <ArrowUp size={14} aria-hidden="true" /> Avançar camada
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={element.locked}
        onClick={() => run(() => moveElementBackward(element.id))}
      >
        <ArrowDown size={14} aria-hidden="true" /> Recuar camada
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={element.locked}
        onClick={() => run(() => sendElementToBack(element.id))}
      >
        <ChevronsDown size={14} aria-hidden="true" /> Enviar para trás
      </button>
      <hr />
      <button type="button" role="menuitem" onClick={() => run(() => toggleElementLock(element.id))}>
        {element.locked ? <Unlock size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
        {element.locked ? "Desbloquear" : "Bloquear"}
      </button>
      <button type="button" role="menuitem" onClick={() => run(() => toggleElementVisibility(element.id))}>
        <EyeOff size={14} aria-hidden="true" /> Ocultar
      </button>
      <button
        type="button"
        role="menuitem"
        className="danger"
        disabled={element.locked}
        onClick={() => run(() => deleteElement(element.id))}
      >
        <Trash2 size={14} aria-hidden="true" /> Excluir
      </button>
    </div>,
    document.body,
  );
}
