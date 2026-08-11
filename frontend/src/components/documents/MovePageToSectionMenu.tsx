import { MoveRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { NotebookSection } from "../../types/notebook.types";

interface MovePageToSectionMenuProps {
  sections: NotebookSection[];
  currentSectionId: string;
  disabled?: boolean;
  onMove: (sectionId: string) => void;
}

interface MenuPosition {
  top: number;
  left: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function MovePageToSectionMenu({
  sections,
  currentSectionId,
  disabled = false,
  onMove,
}: MovePageToSectionMenuProps) {
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
      const width = 220;
      setPosition({
        top: Math.min(rect.bottom + 8, window.innerHeight - 240),
        left: clamp(rect.left - width / 2 + rect.width / 2, 12, window.innerWidth - width - 12),
      });
    }
    setOpen(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="notebook-navigation-button"
        aria-label="Mover folha para seção"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          openMenu();
        }}
      >
        <MoveRight size={15} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="notebook-section-menu"
            role="menu"
            aria-label="Mover folha para seção"
            style={{ top: position.top, left: position.left }}
          >
            {sections.map((section) => {
              const title = section.title.trim() || "Seção sem título";
              const isCurrent = section.id === currentSectionId;
              return (
                <button
                  key={section.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isCurrent}
                  disabled={isCurrent}
                  onClick={() => {
                    onMove(section.id);
                    setOpen(false);
                    buttonRef.current?.focus({ preventScroll: true });
                  }}
                >
                  {title}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
