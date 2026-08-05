import type { DocumentType } from "../types/document.types";
import type { ZoomMode } from "../types/editor.types";

export interface DocumentGeometry {
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
  spineWidth?: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface CalculatedDocumentViewport {
  scale: number;
  automaticScale: number;
  zoom: number;
  zoomMode: ZoomMode;
  availableWidth: number;
  availableHeight: number;
  renderedWidth: number;
  renderedHeight: number;
  requiresHorizontalPan: boolean;
  requiresVerticalPan: boolean;
}

export const MIN_EDITOR_SCALE = 0.78;
export const MAX_EDITOR_SCALE = 1.35;
export const MAX_FIT_SCALE = 1;
export const MIN_EDITOR_ZOOM = 0.5;
export const MAX_EDITOR_ZOOM = 1.5;
export const EDITOR_ZOOM_STEP = 0.1;
const PAN_EPSILON = 0.5;

export const EDITOR_LAYOUT = {
  documentMarginX: 28,
  documentMarginTop: 10,
  documentMarginBottom: 10,
  documentSwitcherHeight: 0,
  bottomDockReservedHeight: 96,
  contextualToolbarReservedHeight: 46,
  zoomControlsReservedWidth: 150,
  desktopScrollableMinimumWidth: 900,
  compactSidebarBreakpoint: 1100,
} as const;

export const DOCUMENT_GEOMETRY = {
  notebook: {
    width: 1074,
    height: 700,
    pageWidth: 504,
    pageHeight: 668,
    spineWidth: 34,
  },
  notepad: {
    width: 560,
    height: 760,
    pageWidth: 520,
    pageHeight: 710,
  },
  clipboard: {
    width: 610,
    height: 780,
    pageWidth: 500,
    pageHeight: 670,
  },
} satisfies Record<DocumentType, DocumentGeometry>;

export const NOTEBOOK_GEOMETRY = DOCUMENT_GEOMETRY.notebook;

export const EDITOR_BREAKPOINTS = {
  wide: 1280,
  compact: 1024,
  narrow: 760,
} as const;

export function clampEditorZoom(zoom: number): number {
  return Math.min(MAX_EDITOR_ZOOM, Math.max(MIN_EDITOR_ZOOM, zoom));
}

export function calculateAvailableDocumentSize(
  viewport: ViewportSize,
  reserveContextualToolbar = false,
): ViewportSize {
  return {
    width: Math.max(1, viewport.width - EDITOR_LAYOUT.documentMarginX * 2),
    height: Math.max(
      1,
      viewport.height -
      EDITOR_LAYOUT.documentSwitcherHeight -
      EDITOR_LAYOUT.bottomDockReservedHeight -
      EDITOR_LAYOUT.documentMarginTop -
      EDITOR_LAYOUT.documentMarginBottom -
      (reserveContextualToolbar ? EDITOR_LAYOUT.contextualToolbarReservedHeight : 0),
    ),
  };
}

export function calculateDocumentViewport(
  viewport: ViewportSize,
  geometry: DocumentGeometry,
  zoom = 1,
  zoomMode: ZoomMode = "fit",
  reserveContextualToolbar = false,
): CalculatedDocumentViewport {
  const available = calculateAvailableDocumentSize(viewport, reserveContextualToolbar);
  const safeWidth = Math.max(1, available.width);
  const safeHeight = Math.max(1, available.height);
  const widthScale = safeWidth / geometry.width;
  const heightScale = safeHeight / geometry.height;
  const automaticScale = Math.min(widthScale, heightScale);
  const clampedZoom = clampEditorZoom(zoom);
  const shouldUseScrollableMinimum = viewport.width < EDITOR_LAYOUT.desktopScrollableMinimumWidth;
  const fitScale = Math.min(MAX_FIT_SCALE, automaticScale);
  const scale =
    zoomMode === "fit"
      ? shouldUseScrollableMinimum
        ? Math.max(MIN_EDITOR_SCALE, fitScale)
        : fitScale
      : Math.min(MAX_EDITOR_SCALE, Math.max(MIN_EDITOR_ZOOM, clampedZoom));
  const renderedWidth = geometry.width * scale;
  const renderedHeight = geometry.height * scale;

  return {
    scale,
    automaticScale,
    zoom: clampedZoom,
    zoomMode,
    availableWidth: safeWidth,
    availableHeight: safeHeight,
    renderedWidth,
    renderedHeight,
    requiresHorizontalPan: renderedWidth > safeWidth + PAN_EPSILON,
    requiresVerticalPan: renderedHeight > safeHeight + PAN_EPSILON,
  };
}
