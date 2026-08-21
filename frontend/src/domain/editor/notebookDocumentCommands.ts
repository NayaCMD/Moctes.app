import type { MoctesDocument } from "../../types/document.types";
import type {
  NotebookDividerUpdate,
  NotebookSection,
  RemoveSectionStrategy,
} from "../../types/notebook.types";
import type { Page } from "../../types/page.types";
import { reconcileNotebookDocument } from "../../utils/notebookMigration.utils";
import {
  buildNotebookSurfaces,
  getPagesInSection,
  getSectionByPageId,
} from "../../utils/notebookSurfaces.utils";

export function insertNotebookSection(
  document: MoctesDocument,
  section: NotebookSection,
  page: Page | null,
  index: number | undefined,
  updatedAt: string,
): MoctesDocument | null {
  const notebook = getNotebook(document);
  if (!notebook) {
    return null;
  }
  const sections = [...(notebook.sections ?? [])];
  sections.splice(clampIndex(index ?? sections.length, 0, sections.length), 0, section);
  return reconcileNotebookDocument({
    ...notebook,
    sections,
    pages: page ? [...notebook.pages, page] : notebook.pages,
    activePageId: page?.id ?? notebook.activePageId,
    activeSurfaceId: section.divider.id,
    updatedAt,
  });
}

export function removeNotebookSection(
  document: MoctesDocument,
  sectionId: string,
  strategy: RemoveSectionStrategy,
  updatedAt: string,
): MoctesDocument | null {
  const notebook = getNotebook(document);
  const sections = notebook?.sections ?? [];
  const removingSection = sections.find((section) => section.id === sectionId);
  if (!notebook || !removingSection || sections.length <= 1) {
    return null;
  }

  const removingPages = getPagesInSection(notebook, removingSection.id);
  const removingPageIds = new Set(removingPages.map((page) => page.id));
  const nextSections = sections.filter((section) => section.id !== sectionId);
  let nextPages = notebook.pages.filter((page) => !removingPageIds.has(page.id));

  if (strategy.mode === "move-pages") {
    if (strategy.targetSectionId === sectionId) {
      return null;
    }
    const targetSection = nextSections.find(
      (section) => section.id === strategy.targetSectionId,
    );
    if (!targetSection) {
      return null;
    }
    const targetLastOrder = getPagesInSection(notebook, targetSection.id).at(-1)?.order ?? 0;
    let movedIndex = 0;
    nextPages = notebook.pages.map((page) =>
      removingPageIds.has(page.id)
        ? {
            ...page,
            sectionId: targetSection.id,
            dividerId: undefined,
            order: targetLastOrder + ++movedIndex,
          }
        : page,
    );
  }

  const firstSurface = buildNotebookSurfaces({
    ...notebook,
    sections: nextSections,
    pages: nextPages,
  })[0];
  const firstPage = nextPages[0];
  return reconcileNotebookDocument({
    ...notebook,
    sections: nextSections,
    pages: nextPages,
    dividers: notebook.dividers.filter(
      (divider) => divider.id !== removingSection.divider.id,
    ),
    activeSurfaceId: firstSurface?.id ?? firstPage?.id ?? notebook.activeSurfaceId,
    activePageId: firstPage?.id ?? notebook.activePageId,
    updatedAt,
  });
}

export function renameNotebookSection(
  document: MoctesDocument,
  sectionId: string,
  title: string,
  updatedAt: string,
): MoctesDocument | null {
  const notebook = getNotebook(document);
  const nextTitle = title.trim();
  const section = notebook?.sections?.find((item) => item.id === sectionId);
  if (!notebook || !section || !nextTitle || section.title === nextTitle) {
    return null;
  }
  return reconcileNotebookDocument({
    ...notebook,
    sections: notebook.sections?.map((item) =>
      item.id === sectionId ? { ...item, title: nextTitle } : item,
    ),
    updatedAt,
  });
}

export function reorderNotebookSections(
  document: MoctesDocument,
  fromIndex: number,
  toIndex: number,
  updatedAt: string,
): MoctesDocument | null {
  const notebook = getNotebook(document);
  const sections = notebook?.sections ?? [];
  if (
    !notebook ||
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= sections.length ||
    toIndex >= sections.length
  ) {
    return null;
  }
  return reconcileNotebookDocument({
    ...notebook,
    sections: moveArrayItem(sections, fromIndex, toIndex),
    updatedAt,
  });
}

export function updateNotebookSectionDivider(
  document: MoctesDocument,
  sectionId: string,
  updates: NotebookDividerUpdate,
  updatedAt: string,
): MoctesDocument | null {
  const notebook = getNotebook(document);
  const section = notebook?.sections?.find((item) => item.id === sectionId);
  if (!notebook || !section) {
    return null;
  }
  const nextTitle = updates.title?.trim();
  const nextSection: NotebookSection = {
    ...section,
    title: nextTitle || section.title,
    divider: {
      ...section.divider,
      color: updates.color ?? section.divider.color,
      tabColor: updates.tabColor ?? section.divider.tabColor,
      textColor: updates.textColor ?? section.divider.textColor,
      tabPosition: updates.tabPosition ?? section.divider.tabPosition,
      material: updates.material ?? section.divider.material,
      textureIntensity:
        updates.textureIntensity ?? section.divider.textureIntensity,
    },
  };
  if (sectionsEqual(section, nextSection)) {
    return null;
  }
  return reconcileNotebookDocument({
    ...notebook,
    sections: notebook.sections?.map((item) =>
      item.id === sectionId ? nextSection : item,
    ),
    updatedAt,
  });
}

export function insertNotebookPage(
  document: MoctesDocument,
  page: Page,
  updatedAt: string,
): MoctesDocument | null {
  const notebook = getNotebook(document);
  if (!notebook || !page.sectionId || !notebook.sections?.some((section) => section.id === page.sectionId)) {
    return null;
  }
  return reconcileNotebookDocument({
    ...notebook,
    pages: [...notebook.pages, page],
    activePageId: page.id,
    activeSurfaceId: page.id,
    updatedAt,
  });
}

export function moveNotebookPage(
  document: MoctesDocument,
  pageId: string,
  targetSectionId: string,
  index: number | undefined,
  updatedAt: string,
): MoctesDocument | null {
  const notebook = getNotebook(document);
  const page = notebook?.pages.find((item) => item.id === pageId);
  const sourceSection = notebook ? getSectionByPageId(notebook, pageId) : undefined;
  const targetSection = notebook?.sections?.find((section) => section.id === targetSectionId);
  if (!notebook || !page || !sourceSection || !targetSection) {
    return null;
  }
  const sourcePages = getPagesInSection(notebook, sourceSection.id);
  const targetPages = getPagesInSection(notebook, targetSection.id)
    .filter((item) => item.id !== pageId);
  const currentIndex = sourcePages.findIndex((item) => item.id === pageId);
  const targetIndex = clampIndex(index ?? targetPages.length, 0, targetPages.length);
  if (sourceSection.id === targetSection.id && currentIndex === targetIndex) {
    return null;
  }
  const movedPage = {
    ...page,
    sectionId: targetSection.id,
    dividerId: undefined,
    order: getSectionInsertionOrder(targetPages, targetIndex),
  };
  return reconcileNotebookDocument({
    ...notebook,
    pages: notebook.pages.map((item) => item.id === pageId ? movedPage : item),
    activePageId: pageId,
    activeSurfaceId: pageId,
    updatedAt,
  });
}

export function removeNotebookPage(
  document: MoctesDocument,
  pageId: string,
  updatedAt: string,
): MoctesDocument | null {
  const notebook = getNotebook(document);
  if (!notebook?.pages.some((page) => page.id === pageId)) {
    return null;
  }
  const remainingPages = notebook.pages.filter((page) => page.id !== pageId);
  if (remainingPages.length === 0) {
    return null;
  }
  return reconcileNotebookDocument({
    ...notebook,
    pages: remainingPages,
    activePageId: remainingPages[0].id,
    activeSurfaceId: remainingPages[0].id,
    updatedAt,
  });
}

export function reorderNotebookPages(
  document: MoctesDocument,
  sectionId: string,
  fromIndex: number,
  toIndex: number,
  updatedAt: string,
): MoctesDocument | null {
  const notebook = getNotebook(document);
  const section = notebook?.sections?.find((item) => item.id === sectionId);
  const sectionPages = notebook ? getPagesInSection(notebook, sectionId) : [];
  if (
    !notebook ||
    !section ||
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= sectionPages.length ||
    toIndex >= sectionPages.length
  ) {
    return null;
  }
  const orderedPageIds = moveArrayItem(sectionPages, fromIndex, toIndex)
    .map((page) => page.id);
  const orderByPageId = new Map(
    orderedPageIds.map((pageId, pageIndex) => [pageId, pageIndex + 1]),
  );
  return reconcileNotebookDocument({
    ...notebook,
    pages: notebook.pages.map((page) =>
      page.sectionId === sectionId
        ? { ...page, order: orderByPageId.get(page.id) ?? page.order }
        : page,
    ),
    updatedAt,
  });
}

export function getSectionInsertionOrder(
  pages: Page[],
  requestedIndex?: number,
): number {
  const ordered = [...pages].sort((first, second) => first.order - second.order);
  const index = clampIndex(requestedIndex ?? ordered.length, 0, ordered.length);
  const previous = ordered[index - 1];
  const next = ordered[index];
  if (!previous && !next) return 1;
  if (!previous) return next.order - 0.5;
  if (!next) return previous.order + 0.5;
  return (previous.order + next.order) / 2;
}

function getNotebook(document: MoctesDocument): MoctesDocument | null {
  return document.type === "notebook" ? reconcileNotebookDocument(document) : null;
}

function clampIndex(index: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, index));
}

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function sectionsEqual(first: NotebookSection, second: NotebookSection): boolean {
  return (
    first.title === second.title &&
    first.divider.color === second.divider.color &&
    first.divider.tabColor === second.divider.tabColor &&
    first.divider.textColor === second.divider.textColor &&
    first.divider.tabPosition === second.divider.tabPosition &&
    first.divider.material === second.divider.material &&
    first.divider.textureIntensity === second.divider.textureIntensity
  );
}
