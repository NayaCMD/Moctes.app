import type { NotebookSurface, NotebookTransitionDirection } from "../types/notebook.types";

export const NOTEBOOK_FLIP_DURATION_MS = 650;
export const NOTEBOOK_FLIP_FALLBACK_MARGIN_MS = 120;

export function getNotebookTransitionDirection(
  surfaces: NotebookSurface[],
  fromSurfaceId: string,
  toSurfaceId: string,
): NotebookTransitionDirection | null {
  const fromIndex = surfaces.findIndex((surface) => surface.id === fromSurfaceId);
  const toIndex = surfaces.findIndex((surface) => surface.id === toSurfaceId);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return null;
  }

  return toIndex > fromIndex ? "forward" : "backward";
}

export function getSurfaceOffsetTarget(
  surfaces: NotebookSurface[],
  currentSurfaceId: string | undefined,
  offset: number,
): NotebookSurface | undefined {
  const currentIndex = surfaces.findIndex((surface) => surface.id === currentSurfaceId);

  if (currentIndex < 0) {
    return undefined;
  }

  return surfaces[currentIndex + offset];
}
