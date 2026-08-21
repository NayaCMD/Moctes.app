import {
  ArrowDown,
  ArrowUp,
  Copy,
  Lock,
  MoreHorizontal,
  Unlock,
} from "lucide-react";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type { PageElement } from "../../types/element.types";
import {
  calculateContextMenuOrigin,
  calculateQuickActionsPosition,
} from "./elementQuickActions.position";

interface ElementQuickActionsProps {
  element: PageElement;
  elements: PageElement[];
  pageElement: HTMLElement;
}

interface ToolbarPosition {
  left: number;
  top: number;
}

const PAGE_PADDING = 8;

export function ElementQuickActions({
  element,
  elements,
  pageElement,
}: ElementQuickActionsProps) {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const duplicateElement = useDocumentStore((state) => state.duplicateElement);
  const toggleElementLock = useDocumentStore((state) => state.toggleElementLock);
  const moveElementForward = useDocumentStore((state) => state.moveElementForward);
  const moveElementBackward = useDocumentStore((state) => state.moveElementBackward);
  const openContextMenu = useEditorStore((state) => state.openContextMenu);
  const closeContextMenu = useEditorStore((state) => state.closeContextMenu);
  const contextMenu = useEditorStore((state) => state.contextMenu);
  const interaction = useEditorStore((state) => state.interaction);

  const canMoveBackward =
    !element.locked && elements.some((candidate) => candidate.zIndex < element.zIndex);
  const canMoveForward =
    !element.locked && elements.some((candidate) => candidate.zIndex > element.zIndex);

  const updatePosition = useCallback(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    const pageRect = pageElement.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    if (pageRect.width <= 0 || pageRect.height <= 0) return;

    const elementLeft = pageRect.left + (element.x / 100) * pageRect.width;
    const elementTop = pageRect.top + (element.y / 100) * pageRect.height;
    const elementWidth = (element.width / 100) * pageRect.width;
    const elementHeight = (element.height / 100) * pageRect.height;
    const visualViewport = window.visualViewport;
    const viewportLeft = visualViewport?.offsetLeft ?? 0;
    const viewportTop = visualViewport?.offsetTop ?? 0;
    const viewportWidth = visualViewport?.width ?? window.innerWidth;
    const viewportHeight = visualViewport?.height ?? window.innerHeight;
    let viewportBottom = viewportTop + viewportHeight - PAGE_PADDING;
    const bottomDock = document.querySelector<HTMLElement>(".bottom-toolbar-wrap");
    const bottomDockRect = bottomDock?.getBoundingClientRect();
    if (bottomDockRect && bottomDockRect.top > elementTop + elementHeight) {
      viewportBottom = Math.min(viewportBottom, bottomDockRect.top - PAGE_PADDING);
    }

    const nextPosition = calculateQuickActionsPosition(
      {
        left: elementLeft,
        top: elementTop,
        width: elementWidth,
        height: elementHeight,
      },
      { width: toolbarRect.width, height: toolbarRect.height },
      {
        left: viewportLeft + PAGE_PADDING,
        top: viewportTop + PAGE_PADDING,
        right: viewportLeft + viewportWidth - PAGE_PADDING,
        bottom: viewportBottom,
      },
    );

    setPosition((current) =>
      current?.left === nextPosition.left && current.top === nextPosition.top
        ? current
        : nextPosition,
    );
  }, [element.height, element.width, element.x, element.y, pageElement]);

  useLayoutEffect(() => {
    updatePosition();
    const observer = new ResizeObserver(updatePosition);
    observer.observe(pageElement);
    if (toolbarRef.current) observer.observe(toolbarRef.current);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [pageElement, updatePosition]);

  if (interaction.mode !== "idle") return null;

  const stopEditorEvent = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const menuOpenForElement = contextMenu.open && contextMenu.elementId === element.id;

  const runQuickAction = (action: () => void) => {
    closeContextMenu();
    action();
  };

  const style = {
    left: position?.left ?? PAGE_PADDING,
    top: position?.top ?? PAGE_PADDING,
    visibility: position ? "visible" : "hidden",
  } satisfies CSSProperties;

  return createPortal(
    <div
      ref={toolbarRef}
      className="element-quick-actions"
      role="toolbar"
      aria-label="Ações do elemento selecionado"
      style={style}
      onPointerDown={stopEditorEvent}
      onPointerUp={stopEditorEvent}
      onClick={stopEditorEvent}
      onDoubleClick={stopEditorEvent}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <button
        type="button"
        className="element-quick-action element-quick-action-layer"
        aria-label="Baixar uma camada"
        title="Baixar uma camada"
        disabled={!canMoveBackward}
        onClick={() => runQuickAction(() => moveElementBackward(element.id))}
      >
        <ArrowDown size={16} aria-hidden="true" />
        <span>Baixar</span>
      </button>
      <button
        type="button"
        className="element-quick-action element-quick-action-layer"
        aria-label="Elevar uma camada"
        title="Elevar uma camada"
        disabled={!canMoveForward}
        onClick={() => runQuickAction(() => moveElementForward(element.id))}
      >
        <ArrowUp size={16} aria-hidden="true" />
        <span>Elevar</span>
      </button>
      <span className="element-quick-actions-divider" aria-hidden="true" />
      <button
        type="button"
        className="element-quick-action"
        aria-label="Duplicar elemento"
        title="Duplicar"
        disabled={element.locked}
        onClick={() => runQuickAction(() => duplicateElement(element.id))}
      >
        <Copy size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="element-quick-action"
        aria-label={element.locked ? "Desbloquear elemento" : "Bloquear elemento"}
        title={element.locked ? "Desbloquear" : "Bloquear"}
        aria-pressed={element.locked}
        onClick={() => runQuickAction(() => toggleElementLock(element.id))}
      >
        {element.locked ? (
          <Unlock size={16} aria-hidden="true" />
        ) : (
          <Lock size={16} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        className="element-quick-action"
        aria-label="Mais ações do elemento"
        title="Mais ações"
        aria-haspopup="menu"
        aria-controls="element-context-menu"
        aria-expanded={menuOpenForElement}
        onClick={(event) => {
          if (menuOpenForElement) {
            closeContextMenu();
            return;
          }
          const toolbarRect = event.currentTarget
            .closest<HTMLElement>(".element-quick-actions")
            ?.getBoundingClientRect();
          const buttonRect = event.currentTarget.getBoundingClientRect();
          const anchor = toolbarRect ?? buttonRect;
          const origin = calculateContextMenuOrigin(
            {
              left: anchor.left,
              top: anchor.top,
              width: anchor.width,
              height: anchor.height,
            },
            { width: window.innerWidth, height: window.innerHeight },
          );
          openContextMenu(element.id, origin.left, origin.top);
        }}
      >
        <MoreHorizontal size={17} aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}
