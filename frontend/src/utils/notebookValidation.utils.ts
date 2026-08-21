import type { MoctesDocument } from "../types/document.types";
import type { NotebookSection } from "../types/notebook.types";
import { buildNotebookSurfaces } from "./notebookSurfaces.utils";

export type NotebookValidationCode =
  | "MISSING_COVER"
  | "MISSING_SECTIONS"
  | "MISSING_SECTION_ID"
  | "MISSING_DIVIDER"
  | "MISSING_ACTIVE_SURFACE"
  | "INVALID_ACTIVE_SURFACE"
  | "DUPLICATE_ID"
  | "DUPLICATE_PAGE"
  | "ORPHAN_PAGE"
  | "LOOSE_DIVIDER";

export interface NotebookValidationError {
  code: NotebookValidationCode;
  message: string;
  id?: string;
}

export interface NotebookValidationResult {
  valid: boolean;
  errors: NotebookValidationError[];
}

export function validateNotebookDocument(document: MoctesDocument): NotebookValidationResult {
  const errors: NotebookValidationError[] = [];

  if (!document.cover) {
    errors.push({ code: "MISSING_COVER", message: "Notebook document is missing a cover." });
  }

  if (!document.sections || document.sections.length === 0) {
    errors.push({ code: "MISSING_SECTIONS", message: "Notebook document has no sections." });
  }

  const sections = document.sections ?? [];
  const sectionIds = new Set<string>();
  const dividerIds = new Set<string>();
  const pageIds = new Set<string>();
  const allIds = new Set<string>();

  for (const section of sections) {
    validateSection(section, errors, sectionIds, dividerIds, allIds);
  }

  for (const page of document.pages) {
    if (pageIds.has(page.id)) {
      errors.push({
        code: "DUPLICATE_PAGE",
        id: page.id,
        message: `Page ${page.id} appears more than once in the notebook.`,
      });
      continue;
    }
    pageIds.add(page.id);
    trackUniqueId(page.id, "Page", errors, allIds);

    if (!page.sectionId || !sectionIds.has(page.sectionId)) {
      errors.push({
        code: "ORPHAN_PAGE",
        id: page.id,
        message: `Page ${page.id} is not assigned to a notebook section.`,
      });
    }
  }

  for (const divider of document.dividers) {
    if (!dividerIds.has(divider.id)) {
      errors.push({
        code: "LOOSE_DIVIDER",
        id: divider.id,
        message: `Divider ${divider.id} is not assigned to a notebook section.`,
      });
    }
  }

  if (!document.activeSurfaceId) {
    errors.push({
      code: "MISSING_ACTIVE_SURFACE",
      message: "Notebook document is missing activeSurfaceId.",
    });
  } else if (!buildNotebookSurfaces(document).some((surface) => surface.id === document.activeSurfaceId)) {
    errors.push({
      code: "INVALID_ACTIVE_SURFACE",
      id: document.activeSurfaceId,
      message: `Active surface ${document.activeSurfaceId} does not exist.`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateSection(
  section: NotebookSection,
  errors: NotebookValidationError[],
  sectionIds: Set<string>,
  dividerIds: Set<string>,
  allIds: Set<string>,
) {
  if (!section.id) {
    errors.push({ code: "MISSING_SECTION_ID", message: "Notebook section is missing an ID." });
  } else if (sectionIds.has(section.id)) {
    errors.push({
      code: "DUPLICATE_ID",
      id: section.id,
      message: `Section ID ${section.id} is duplicated.`,
    });
  } else {
    sectionIds.add(section.id);
    trackUniqueId(section.id, "Section", errors, allIds);
  }

  if (!section.divider?.id) {
    errors.push({
      code: "MISSING_DIVIDER",
      id: section.id,
      message: `Section ${section.id || "(missing ID)"} is missing a divider.`,
    });
  } else if (dividerIds.has(section.divider.id)) {
    errors.push({
      code: "DUPLICATE_ID",
      id: section.divider.id,
      message: `Divider ID ${section.divider.id} is duplicated.`,
    });
  } else {
    dividerIds.add(section.divider.id);
    trackUniqueId(section.divider.id, "Divider", errors, allIds);
  }

}

function trackUniqueId(
  id: string,
  label: string,
  errors: NotebookValidationError[],
  allIds: Set<string>,
) {
  if (allIds.has(id)) {
    errors.push({
      code: "DUPLICATE_ID",
      id,
      message: `${label} ID ${id} is duplicated across notebook entities.`,
    });
    return;
  }

  allIds.add(id);
}
