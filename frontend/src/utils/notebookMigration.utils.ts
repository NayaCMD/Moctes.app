import type { Divider, MoctesDocument } from "../types/document.types";
import type { NotebookCover, NotebookSection } from "../types/notebook.types";
import { NOTEBOOK_SCHEMA_VERSION } from "../types/notebook.types";
import type { Page } from "../types/page.types";
import { buildNotebookSurfaces } from "./notebookSurfaces.utils";
import { validateNotebookDocument } from "./notebookValidation.utils";

const DEFAULT_SECTION_TITLE = "Anotações";
const DEFAULT_COVER_RADIUS = 28;
const DEFAULT_DIVIDER_COLOR = "#d9f4f7";
const DEFAULT_TAB_COLOR = "#bde4eb";
const DEFAULT_TEXT_COLOR = "#26324a";

type LegacyNotebookSection = NotebookSection & { pages?: Page[] };

export function createDefaultNotebookCover(
  document?: Pick<MoctesDocument, "coverColor" | "coverBorderColor">,
): NotebookCover {
  return {
    color: document?.coverColor ?? "#bde4eb",
    borderColor: document?.coverBorderColor ?? "#8dcbd7",
    cornerRadius: DEFAULT_COVER_RADIUS,
    material: "linen",
    textureIntensity: 18,
  };
}

export function createDefaultNotebookSection(options: {
  documentId?: string;
  title?: string;
  dividerId?: string;
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
      material: "smooth",
      textureIntensity: 12,
    },
  };
}

function createNotebookId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/**
 * Converts every legacy notebook representation into the canonical V3 model.
 * Pages live only in document.pages and reference their section through sectionId.
 */
export function migrateDocumentToSchemaV3(document: MoctesDocument): MoctesDocument {
  if (document.type !== "notebook") {
    return document;
  }

  const rawSections = Array.isArray(document.sections)
    ? (document.sections as LegacyNotebookSection[])
    : [];
  const sections = rawSections.length > 0
    ? rawSections.map((section, index) => toCanonicalSection(section, index))
    : [...document.dividers]
        .sort((first, second) => first.order - second.order)
        .map((divider, index) => createSectionFromLegacyDivider(divider, index));

  if (sections.length === 0) {
    sections.push(createDefaultNotebookSection({
      documentId: document.id,
      dividerId: `divider-${document.id}-default`,
    }));
  }

  const sectionIds = new Set(sections.map((section) => section.id));
  const sectionIdByDividerId = new Map(
    sections.map((section) => [section.divider.id, section.id]),
  );
  const embeddedSectionByPageId = new Map<string, string>();
  const embeddedPageById = new Map<string, Page>();

  for (const section of rawSections) {
    for (const page of getLegacySectionPages(section)) {
      if (!embeddedSectionByPageId.has(page.id)) {
        embeddedSectionByPageId.set(page.id, section.id);
      }
      if (!embeddedPageById.has(page.id)) {
        embeddedPageById.set(page.id, page);
      }
    }
  }

  const pageById = new Map<string, Page>();
  for (const page of document.pages) {
    if (!pageById.has(page.id)) {
      pageById.set(page.id, page);
    }
  }
  for (const [pageId, page] of embeddedPageById) {
    if (!pageById.has(pageId)) {
      pageById.set(pageId, page);
    }
  }

  let defaultSection = sections.find(
    (section) => section.id === `section-${document.id}-default`,
  );
  const ensureDefaultSection = (): NotebookSection => {
    if (defaultSection) {
      return defaultSection;
    }
    defaultSection = createDefaultNotebookSection({
      documentId: document.id,
      dividerId: `divider-${document.id}-default`,
      tabPosition: sections.length,
    });
    sections.push(defaultSection);
    sectionIds.add(defaultSection.id);
    sectionIdByDividerId.set(defaultSection.divider.id, defaultSection.id);
    return defaultSection;
  };

  const canonicalPages = [...pageById.values()].map((page) => {
    const explicitSectionId = page.sectionId && sectionIds.has(page.sectionId)
      ? page.sectionId
      : undefined;
    const embeddedSectionId = embeddedSectionByPageId.get(page.id);
    const legacySectionId = page.dividerId
      ? sectionIdByDividerId.get(page.dividerId)
      : undefined;
    const sectionId = explicitSectionId
      ?? (embeddedSectionId && sectionIds.has(embeddedSectionId) ? embeddedSectionId : undefined)
      ?? legacySectionId
      ?? ensureDefaultSection().id;

    return {
      ...page,
      sectionId,
      dividerId: undefined,
    };
  });

  const pages = orderPagesBySections(sections, canonicalPages);
  const activePageId = pages.some((page) => page.id === document.activePageId)
    ? document.activePageId
    : pages[0]?.id ?? document.activePageId;
  const dividers = ensureLegacyDividers(document, sections);
  const migrated: MoctesDocument = {
    ...document,
    schemaVersion: NOTEBOOK_SCHEMA_VERSION,
    cover: document.cover
      ? {
          ...document.cover,
          material: document.cover.material ?? "linen",
          textureIntensity: Number.isFinite(document.cover.textureIntensity)
            ? document.cover.textureIntensity
            : 18,
        }
      : createDefaultNotebookCover(document),
    binding: document.binding ?? "left",
    sections,
    pages,
    dividers,
    activePageId,
  };
  const activeSurfaceId = buildNotebookSurfaces(migrated).some(
    (surface) => surface.id === migrated.activeSurfaceId,
  )
    ? migrated.activeSurfaceId
    : deriveActiveSurfaceId(migrated, activePageId);
  const canonical = { ...migrated, activeSurfaceId };

  const validation = validateNotebookDocument(canonical);
  if (!validation.valid) {
    throw new Error(
      `Notebook migration produced an invalid document: ${validation.errors
        .map((error) => error.code)
        .join(", ")}`,
    );
  }

  return canonical;
}

/** @deprecated Use migrateDocumentToSchemaV3. */
export const migrateDocumentToSchemaV2 = migrateDocumentToSchemaV3;

export function reconcileNotebookDocument(document: MoctesDocument): MoctesDocument {
  return migrateDocumentToSchemaV3(document);
}

export const syncNotebookSectionsWithPages = reconcileNotebookDocument;

function toCanonicalSection(
  section: LegacyNotebookSection,
  index: number,
): NotebookSection {
  return {
    id: section.id,
    title: section.title,
    divider: {
      ...section.divider,
      tabPosition: Number.isFinite(section.divider.tabPosition)
        ? section.divider.tabPosition
        : index,
      material: section.divider.material ?? "smooth",
      textureIntensity: Number.isFinite(section.divider.textureIntensity)
        ? section.divider.textureIntensity
        : 12,
    },
  };
}

function getLegacySectionPages(section: LegacyNotebookSection): Page[] {
  return Array.isArray(section.pages) ? section.pages : [];
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
      material: "smooth",
      textureIntensity: 12,
    },
  };
}

function orderPagesBySections(
  sections: NotebookSection[],
  pages: Page[],
): Page[] {
  const sectionOrder = new Map(
    sections.map((section, index) => [section.id, index]),
  );

  return [...pages]
    .sort((first, second) => {
      const firstSection = sectionOrder.get(first.sectionId ?? "") ?? sections.length;
      const secondSection = sectionOrder.get(second.sectionId ?? "") ?? sections.length;
      return firstSection - secondSection || first.order - second.order;
    })
    .map((page, index) => ({ ...page, order: index + 1 }));
}

function ensureLegacyDividers(
  document: MoctesDocument,
  sections: NotebookSection[],
): Divider[] {
  const existingById = new Map(document.dividers.map((divider) => [divider.id, divider]));
  return sections.map((section, index) => {
    const existing = existingById.get(section.divider.id);
    return existing
      ? { ...existing, name: section.title, color: section.divider.color, order: index + 1 }
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
  return surfaces.find((surface) => surface.id === activePageId)?.id
    ?? surfaces[0]?.id
    ?? activePageId;
}
