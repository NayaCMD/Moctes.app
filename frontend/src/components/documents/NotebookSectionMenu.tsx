import { MoreVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface NotebookSectionMenuProps {
  sectionTitle: string;
  disabled?: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onRename: () => void;
  onCustomize: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onRemove: () => void;
}

interface MenuPosition {
  top: number;
  left: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function NotebookSectionMenu({
  sectionTitle,
  disabled = false,
  canMoveLeft,
  canMoveRight,
  onRename,
  onCustomize,
  onMoveLeft,
  onMoveRight,
  onRemove,
}: NotebookSectionMenuProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
      buttonRef.current?.focus({ preventScroll: true });
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus({ preventScroll: true });
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    menuRef.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus({ preventScroll: true });

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = 216;
      setPosition({
        top: Math.min(rect.bottom + 8, window.innerHeight - 230),
        left: clamp(rect.right - width, 12, window.innerWidth - width - 12),
      });
    }
    setOpen(true);
  };

  const runAction = (action: () => void) => {
    action();
    setOpen(false);
    buttonRef.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="notebook-tab-menu-button"
        aria-label={`Ações da seção ${sectionTitle}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          if (open) {
            setOpen(false);
            return;
          }
          openMenu();
        }}
      >
        <MoreVertical size={14} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="notebook-section-menu"
            role="menu"
            aria-label={`Menu da seção ${sectionTitle}`}
            style={{ top: position.top, left: position.left }}
          >
            <button type="button" role="menuitem" onClick={() => runAction(onRename)}>
              Renomear
            </button>
            <button type="button" role="menuitem" onClick={() => runAction(onCustomize)}>
              Personalizar divisória
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!canMoveLeft}
              onClick={() => runAction(onMoveLeft)}
            >
              Mover para a esquerda
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!canMoveRight}
              onClick={() => runAction(onMoveRight)}
            >
              Mover para a direita
            </button>
            <button type="button" role="menuitem" data-danger="true" onClick={() => runAction(onRemove)}>
              Excluir seção
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
