import type { MoctesDocument } from "../types/document.types";
import type { NotebookSection, NotebookSurface } from "../types/notebook.types";

export function buildNotebookSurfaces(document: MoctesDocument): NotebookSurface[] {
  return (document.sections ?? []).flatMap((section) => {
    if (!section.divider?.id) {
      return [];
    }

    return [
      {
        kind: "divider" as const,
        id: section.divider.id,
        sectionId: section.id,
        divider: section.divider,
      },
      ...[...section.pages]
        .sort((first, second) => first.order - second.order)
        .map((page) => ({
          kind: "page" as const,
          id: page.id,
          sectionId: section.id,
          page,
        })),
    ];
  });
}

export function getSurfaceById(
  document: MoctesDocument,
  surfaceId: string,
): NotebookSurface | undefined {
  return buildNotebookSurfaces(document).find((surface) => surface.id === surfaceId);
}

export function getSectionByPageId(
  document: MoctesDocument,
  pageId: string,
): NotebookSection | undefined {
  return document.sections?.find((section) =>
    section.pages.some((page) => page.id === pageId),
  );
}
