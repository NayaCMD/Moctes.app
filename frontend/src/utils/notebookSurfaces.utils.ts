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
      ...getPagesInSection(document, section.id)
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
  const sectionId = document.pages.find((page) => page.id === pageId)?.sectionId;
  return document.sections?.find((section) => section.id === sectionId);
}

export function getPagesInSection(
  document: MoctesDocument,
  sectionId: string,
) {
  return document.pages.filter((page) => page.sectionId === sectionId);
}

export function getActiveSectionId(
  document: MoctesDocument,
  surface: NotebookSurface | undefined,
): string | null {
  if (surface) {
    return surface.sectionId;
  }

  const activeSurface = document.activeSurfaceId
    ? getSurfaceById(document, document.activeSurfaceId)
    : undefined;

  if (activeSurface) {
    return activeSurface.sectionId;
  }

  const activePageSection = document.activePageId
    ? getSectionByPageId(document, document.activePageId)
    : undefined;

  return activePageSection?.id ?? document.sections?.[0]?.id ?? null;
}

export function getNotebookPageCount(document: MoctesDocument): number {
  const seenPageIds = new Set<string>();

  return buildNotebookSurfaces(document).filter((surface) => {
    if (surface.kind !== "page" || seenPageIds.has(surface.id)) {
      return false;
    }

    seenPageIds.add(surface.id);
    return true;
  }).length;
}

export function getNotebookPageNumber(
  document: MoctesDocument,
  pageId: string,
): number | null {
  const pageSurfaces = buildNotebookSurfaces(document).filter(
    (surface) => surface.kind === "page",
  );
  const pageIndex = pageSurfaces.findIndex((surface) => surface.id === pageId);

  return pageIndex >= 0 ? pageIndex + 1 : null;
}

export function isFirstNotebookSurface(
  document: MoctesDocument,
  surfaceId: string | undefined,
): boolean {
  const firstSurface = buildNotebookSurfaces(document)[0];

  return Boolean(firstSurface && surfaceId === firstSurface.id);
}

export function isLastNotebookSurface(
  document: MoctesDocument,
  surfaceId: string | undefined,
): boolean {
  const lastSurface = buildNotebookSurfaces(document).at(-1);

  return Boolean(lastSurface && surfaceId === lastSurface.id);
}
