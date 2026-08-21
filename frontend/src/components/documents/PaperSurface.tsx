import type {
  CSSProperties,
  MouseEvent,
  PointerEvent,
  ReactNode,
  Ref,
} from "react";
import type { Page } from "../../types/page.types";
import type { PaperType } from "../../types/theme.types";
import { getPageAppearance } from "../../utils/paperAppearance.utils";

interface PaperSurfaceProps {
  page: Page;
  children?: ReactNode;
  className?: string;
  editorMode?: string;
  label: string;
  active?: boolean;
  onPageClick?: (
    position: { x: number; y: number },
    event: MouseEvent<HTMLElement>,
  ) => void;
  onPagePointerDown?: (
    position: { x: number; y: number },
    event: PointerEvent<HTMLElement>,
  ) => void;
  surfaceRef?: Ref<HTMLElement>;
}

function getPaperClass(paperType: PaperType): string {
  switch (paperType) {
    case "lined":
      return "paper-pattern-lined";

    case "grid":
      return "paper-pattern-grid";

    case "dotted":
      return "paper-pattern-dotted";

    case "blank":
      return "paper-pattern-plain";
  }
}

export function PaperSurface({
  page,
  children,
  className = "",
  editorMode,
  label,
  active = false,
  onPageClick,
  onPagePointerDown,
  surfaceRef,
}: PaperSurfaceProps) {
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (!onPageClick) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();

    if (event.target !== event.currentTarget) {
      return;
    }

    event.currentTarget.focus({ preventScroll: true });

    onPageClick(
      {
        x:
          ((event.clientX - rect.left) / rect.width) *
          100,
        y:
          ((event.clientY - rect.top) / rect.height) *
          100,
      },
      event,
    );
  };

  const handlePointerDown = (
    event: PointerEvent<HTMLElement>,
  ) => {
    if (
      !onPagePointerDown ||
      event.target !== event.currentTarget
    ) {
      return;
    }

    const rect =
      event.currentTarget.getBoundingClientRect();

    onPagePointerDown(
      {
        x:
          ((event.clientX - rect.left) / rect.width) *
          100,
        y:
          ((event.clientY - rect.top) / rect.height) *
          100,
      },
      event,
    );
  };

  const appearance = getPageAppearance(page);
  const style = {
    "--user-paper-color": appearance.paperColor,
    "--paper-pattern-color":
      appearance.patternColor,
    "--paper-pattern-opacity": `${appearance.patternOpacity}%`,
    "--paper-pattern-size": `${appearance.patternSize}px`,
    "--paper-texture-opacity": `${appearance.textureIntensity}%`,
    "--paper-margin-top": `${appearance.margins.top}%`,
    "--paper-margin-right": `${appearance.margins.right}%`,
    "--paper-margin-bottom": `${appearance.margins.bottom}%`,
    "--paper-margin-left": `${appearance.margins.left}%`,
  } as CSSProperties;

  return (
    <section
      ref={surfaceRef}
      className={`paper-surface ${getPaperClass(
        page.paperType,
      )} ${className}`}
      aria-label={label}
      data-page-id={page.id}
      data-document-id={page.documentId}
      data-editor-mode={editorMode}
      data-active-page={active}
      data-paper-texture={appearance.paperTexture}
      data-margin-guides={appearance.margins.visible}
      tabIndex={-1}
      style={style}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      <span className="paper-texture-layer" aria-hidden="true" />
      <span className="paper-margin-guide" aria-hidden="true" />
      {children}
    </section>
  );
}
