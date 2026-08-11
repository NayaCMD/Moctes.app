import type { NotebookSurface } from "../types/notebook.types";

export interface NotebookSpreadView {
  leftSurface: NotebookSurface | null;
  rightSurface: NotebookSurface | undefined;
}

export function buildNotebookSpreadView(
  surfaces: NotebookSurface[],
  activeSurfaceId: string | undefined,
): NotebookSpreadView {
  const activeIndex = surfaces.findIndex((surface) => surface.id === activeSurfaceId);
  const rightIndex = activeIndex >= 0 ? activeIndex : 0;
  const rightSurface = surfaces[rightIndex];
  const leftSurface = rightIndex > 0 ? surfaces[rightIndex - 1] : null;

  return {
    leftSurface,
    rightSurface,
  };
}
