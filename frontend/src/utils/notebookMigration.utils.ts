import type { Divider, MoctesDocument } from "../types/document.types";
import type {
  NotebookCover,
  NotebookSection,
} from "../types/notebook.types";
import { NOTEBOOK_SCHEMA_VERSION } from "../types/notebook.types";
import type { Page } from "../types/page.types";
import { buildNotebookSurfaces } from "./notebookSurfaces.utils";
import { validateNotebookDocument } from "./notebookValidation.utils";

const DEFAULT_SECTION_TITLE = "Anotações";
const DEFAULT_COVER_RADIUS = 28;
const DEFAULT_DIVIDER_COLOR = "#d9f4f7";
const DEFAULT_TAB_COLOR = "#bde4eb";
const DEFAULT_TEXT_COLOR = "#26324a";

export function createDefaultNotebookCover(
  document?: Pick<MoctesDocument, "coverColor" | "coverBorderColor">,
): NotebookCover {
  return {
    color: document?.coverColor ?? "#bde4eb",
    borderColor: document?.coverBorderColor ?? "#8dcbd7",
    cornerRadius: DEFAULT_COVER_RADIUS,
  };
}

export function createDefaultNotebookSection(options: {
  documentId?: string;
  title?: string;
  dividerId?: string;
  pages?: Page[];
  tabPosition?: number;
} = {}): NotebookSection {
  const title = options.title ?? DEFAULT_SECTION_TITLE;
  const dividerId = options.dividerId ?? createNotebookId("divider");

  return {
    id: options.documentId ? `section-${options.documentId}-default` : createNotebookId("section"),
    title,
    divider: {
      id: dividerId,
      color: DEFAULT_DIVIDER_COLOR,
      tabColor: DEFAULT_TAB_COLOR,
      textColor: DEFAULT_TEXT_COLOR,
      tabPosition: options.tabPosition ?? 0,
    },
    pages: options.pages ?? [],
  };
}

function createNotebookId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function migrateDocumentToSchemaV2(document: MoctesDocument): MoctesDocument {
  if (
    document.schemaVersion === NOTEBOOK_SCHEMA_VERSION &&
    document.cover &&
    document.sections &&
    document.activeSurfaceId
  ) {
    return document;
  }

  if (document.type !== "notebook") {
    return document;
  }

  const cover = createDefaultNotebookCover(document);
  const orderedDividers = [...document.dividers].sort((first, second) => first.order - second.order);
  const sections = orderedDividers.map((divider, index) =>
    createSectionFromLegacyDivider(divider, index),
  );
  const sectionByDividerId = new Map(
    sections.map((section) => [section.divider.id, section]),
  );
  const defaultSection = createDefaultNotebookSection({
    documentId: document.id,
    dividerId: `divider-${document.id}-default`,
    tabPosition: sections.length,
  });

  const migratedPages = [...document.pages]
    .sort((first, second) => first.order - second.order)
    .map((page) => {
      if (page.dividerId && sectionByDividerId.has(page.dividerId)) {
        return page;
      }
      return { ...page, dividerId: defaultSection.divider.id };
    });

  for (const page of migratedPages) {
    const section =
      page.dividerId ? sectionByDividerId.get(page.dividerId) ?? defaultSection : defaultSection;
    section.pages.push(page);
  }

  const hasDefaultPages = defaultSection.pages.length > 0;
  const nextSections = hasDefaultPages || sections.length === 0
    ? [...sections, defaultSection]
    : sections;
  const nextDividers = ensureLegacyDividers(document, nextSections);
  const activeSurfaceId = deriveActiveSurfaceId(
    {
      ...document,
      cover,
      sections: nextSections,
      pages: migratedPages,
      dividers: nextDividers,
    },
    document.activePageId,
  );

  const migratedDocument: MoctesDocument = {
    ...document,
    schemaVersion: NOTEBOOK_SCHEMA_VERSION,
    cover,
    binding: document.binding ?? "left",
    sections: nextSections,
    activeSurfaceId,
    pages: migratedPages,
    dividers: nextDividers,
  };

  const validation = validateNotebookDocument(migratedDocument);
  if (!validation.valid) {
    throw new Error(
      `Notebook migration produced an invalid document: ${validation.errors
        .map((error) => error.code)
        .join(", ")}`,
    );
  }

  return migratedDocument;
}

export function syncNotebookSectionsWithPages(document: MoctesDocument): MoctesDocument {
  if (document.type !== "notebook") {
    return document;
  }

  const migrated = migrateDocumentToSchemaV2(document);
  const currentSections = migrated.sections ?? [];
  const sectionByDividerId = new Map<string, NotebookSection>(
    currentSections.map((section) => [
      section.divider.id,
      {
        ...section,
        pages: [] as Page[],
      },
    ]),
  );

  for (const divider of migrated.dividers) {
    if (!sectionByDividerId.has(divider.id)) {
      const section = createSectionFromLegacyDivider(divider, sectionByDividerId.size);
      sectionByDividerId.set(section.divider.id, section);
    }
  }

  const defaultDividerId = `divider-${migrated.id}-default`;
  let defaultSection: NotebookSection | undefined = sectionByDividerId.get(defaultDividerId);
  const pageDividerIds = new Set(migrated.pages.map((page) => page.dividerId).filter(Boolean));
  const needsDefaultSection = migrated.pages.some(
    (page) => !page.dividerId || !sectionByDividerId.has(page.dividerId),
  );

  if (!defaultSection && needsDefaultSection) {
    defaultSection = createDefaultNotebookSection({
      documentId: migrated.id,
      dividerId: defaultDividerId,
      tabPosition: sectionByDividerId.size,
    });
    sectionByDividerId.set(defaultSection.divider.id, defaultSection);
  }

  const nextPages = migrated.pages.map((page) => {
    if (page.dividerId && sectionByDividerId.has(page.dividerId)) {
      return page;
    }
    if (!defaultSection) {
      defaultSection = createDefaultNotebookSection({
        documentId: migrated.id,
        dividerId: defaultDividerId,
        tabPosition: sectionByDividerId.size,
      });
      sectionByDividerId.set(defaultSection.divider.id, defaultSection);
    }
    return { ...page, dividerId: defaultDividerId };
  });

  for (const page of nextPages) {
    const section = page.dividerId ? sectionByDividerId.get(page.dividerId) : undefined;
    section?.pages.push(page);
  }

  const nextSections = currentSections
    .map((section) => sectionByDividerId.get(section.divider.id))
    .filter((section): section is NotebookSection => Boolean(section))
    .concat(
      [...sectionByDividerId.values()].filter((section) =>
        !currentSections.some((current) => current.divider.id === section.divider.id),
      ),
    )
    .filter((section) => section.pages.length > 0 || pageDividerIds.has(section.divider.id));

  const nextDocument: MoctesDocument = {
    ...migrated,
    pages: nextPages,
    sections: nextSections.length > 0 ? nextSections : [createDefaultNotebookSection({ documentId: migrated.id })],
  };
  const nextDividers = ensureLegacyDividers(nextDocument, nextDocument.sections ?? []);
  const withDividers = { ...nextDocument, dividers: nextDividers };
  const activeSurfaceId = buildNotebookSurfaces(withDividers).some(
    (surface) => surface.id === withDividers.activeSurfaceId,
  )
    ? withDividers.activeSurfaceId
    : deriveActiveSurfaceId(withDividers, withDividers.activePageId);

  const syncedDocument = { ...withDividers, activeSurfaceId };
  const validation = validateNotebookDocument(syncedDocument);
  if (!validation.valid) {
    throw new Error(
      `Notebook sync produced an invalid document: ${validation.errors
        .map((error) => error.code)
        .join(", ")}`,
    );
  }

  return syncedDocument;
}

function createSectionFromLegacyDivider(divider: Divider, index: number): NotebookSection {
  return {
    id: `section-${divider.id}`,
    title: divider.name,
    divider: {
      id: divider.id,
      color: divider.color,
      tabColor: divider.color,
      textColor: DEFAULT_TEXT_COLOR,
      tabPosition: index,
    },
    pages: [],
  };
}

function ensureLegacyDividers(
  document: MoctesDocument,
  sections: NotebookSection[],
): Divider[] {
  const existingById = new Map(document.dividers.map((divider) => [divider.id, divider]));
  return sections.map((section, index) => {
    const existing = existingById.get(section.divider.id);
    return existing
      ? { ...existing, order: index + 1 }
      : {
          id: section.divider.id,
          documentId: document.id,
          name: section.title,
          color: section.divider.color,
          order: index + 1,
        };
  });
}

function deriveActiveSurfaceId(document: MoctesDocument, activePageId: string): string {
  const surfaces = buildNotebookSurfaces(document);
  return surfaces.find((surface) => surface.id === activePageId)?.id ?? surfaces[0]?.id ?? activePageId;
}
