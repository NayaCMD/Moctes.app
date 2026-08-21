import type { CSSProperties, ReactNode } from "react";
import { useEffect, useId, useMemo, useRef } from "react";
import { X } from "lucide-react";
import { useIsCompactTouchEditor } from "../../hooks/useResponsiveEditor";
import type { ActiveToolPanel } from "../../types/editor.types";

export interface ToolPopoverAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

const TOOL_PANEL_SIZES = {
  emoji: { width: 400, maxHeight: 560 },
  shapes: { width: 420, maxHeight: 440 },
  stickers: { width: 420, maxHeight: 440 },
  images: { width: 420, maxHeight: 440 },
  tapes: { width: 380, maxHeight: 400 },
  drawing: { width: 360, maxHeight: 420 },
  visibility: { width: 300, maxHeight: 360 },
  erase: { width: 300, maxHeight: 320 },
  comments: { width: 300, maxHeight: 240 },
} satisfies Record<Exclude<ActiveToolPanel, null>, { width: number; maxHeight: number }>;

interface ToolPopoverProps {
  title: string;
  description?: string;
  panel: Exclude<ActiveToolPanel, null>;
  anchor: ToolPopoverAnchor | null;
  headerAction?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function ToolPopover({
  title,
  description,
  panel,
  anchor,
  headerAction,
  footer,
  children,
  onClose,
  returnFocusTo,
}: ToolPopoverProps) {
  const isCompactTouchEditor = useIsCompactTouchEditor();
  const titleId = useId();
  const contentId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const size = TOOL_PANEL_SIZES[panel];
  const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 720 : window.innerHeight;
  const viewportPadding = 12;
  const width = Math.min(size.width, viewportWidth - viewportPadding * 2);
  const maxHeight = Math.min(size.maxHeight, Math.max(220, viewportHeight - 132));
  const anchorCenter = anchor ? anchor.x + anchor.width / 2 : viewportWidth / 2;
  const left = clamp(anchorCenter - width / 2, viewportPadding, viewportWidth - width - viewportPadding);
  const bottom = anchor ? Math.max(viewportHeight - anchor.y + 12, 96) : 106;
  const arrowLeft = clamp(anchorCenter - left, 18, width - 18);
  const style = useMemo(() => {
    if (isCompactTouchEditor) {
      return {
        left: 0,
        bottom: 0,
        width: "100%",
        maxHeight: "min(76dvh, 620px)",
      } as CSSProperties;
    }
    return {
      left,
      bottom,
      width,
      maxHeight,
      "--tool-popover-arrow-left": `${arrowLeft}px`,
    } as CSSProperties;
  }, [arrowLeft, bottom, isCompactTouchEditor, left, maxHeight, width]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const path = event.composedPath();
      const target = event.target as Element | null;
      if (
        panelRef.current &&
        (panelRef.current.contains(event.target as Node) ||
          path.includes(panelRef.current) ||
          target?.closest?.(".tool-popover") ||
          target?.closest?.(".tool-button") ||
          target?.closest?.(".asset-import-modal"))
      ) {
        return;
      }
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        returnFocusTo?.focus({ preventScroll: true });
      }
    };

    const timer = window.setTimeout(() => window.addEventListener("click", handleClick), 0);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, returnFocusTo]);

  useEffect(() => {
    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    firstFocusable?.focus({ preventScroll: true });
  }, [panel]);

  return (
    <>
      <span className="tool-popover-backdrop" aria-hidden="true" />
      <div
        ref={panelRef}
        className="tool-popover"
        data-panel={panel}
        data-presentation={isCompactTouchEditor ? "sheet" : "popover"}
        role="dialog"
        aria-modal={isCompactTouchEditor}
        aria-labelledby={titleId}
        aria-describedby={description ? contentId : undefined}
        style={style}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="tool-popover-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={contentId}>{description}</p>}
          </div>
          <div className="tool-popover-header-actions">
            {headerAction}
            <button
              type="button"
              aria-label="Fechar painel"
              onClick={() => {
                onClose();
                returnFocusTo?.focus({ preventScroll: true });
              }}
            >
              <X size={15} />
            </button>
          </div>
        </header>
        <div className="tool-popover-content">{children}</div>
        {footer && <footer className="tool-popover-footer">{footer}</footer>}
      </div>
    </>
  );
}
