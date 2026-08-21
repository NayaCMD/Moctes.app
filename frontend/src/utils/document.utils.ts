import type { Divider, DocumentType, MoctesDocument } from "../types/document.types";
import type { PageElement } from "../types/element.types";
import type { NotebookBookState, NotebookTransitionState } from "../types/notebook.types";
import type { Page, PaperAppearance, PaperMargins, PaperTexture } from "../types/page.types";
import type { PaperType } from "../types/theme.types";
import {
  getDefaultPatternSize,
  getPageAppearance,
  normalizePaperAppearance,
} from "./paperAppearance.utils";
import { migrateDocumentToSchemaV3 } from "./notebookMigration.utils";
import { buildNotebookSpreadView } from "./notebookSpread.utils";
import { buildNotebookSurfaces, getSurfaceById } from "./notebookSurfaces.utils";

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function timestamp(): string {
  return new Date().toISOString();
}

export function getOrderedPages(document: MoctesDocument): Page[] {
  return [...document.pages].sort((first, second) => first.order - second.order);
}

export function getActivePage(document: MoctesDocument): Page | undefined {
  return document.pages.find((page) => page.id === document.activePageId);
}

export function isNotebookPageSurfaceActive(document: MoctesDocument): boolean {
  if (document.type !== "notebook") {
    return true;
  }

  const activeSurface = document.activeSurfaceId
    ? getSurfaceById(document, document.activeSurfaceId)
    : undefined;

  return Boolean(
    activeSurface?.kind === "page" &&
    document.pages.some((page) => page.id === activeSurface.id),
  );
}

interface EditableActivePageOptions {
  notebookBook?: NotebookBookState | null;
  notebookTransition?: NotebookTransitionState | null;
}

export function getEditableActivePage(
  document: MoctesDocument,
  options: EditableActivePageOptions = {},
): Page | undefined {
  if (document.type !== "notebook") {
    return getActivePage(document);
  }

  if (options.notebookTransition?.documentId === document.id) {
    return undefined;
  }

  const notebookPhase =
    options.notebookBook?.documentId === document.id
      ? options.notebookBook.phase
      : "closed";
  if (notebookPhase !== "open") {
    return undefined;
  }

  const focusedPage = getActivePage(document);
  if (!focusedPage) {
    return undefined;
  }

  const spread = buildNotebookSpreadView(
    buildNotebookSurfaces(document),
    document.activeSurfaceId,
  );
  const focusedPageIsVisible = [spread.leftSurface, spread.rightSurface].some(
    (surface) => surface?.kind === "page" && surface.id === focusedPage.id,
  );

  return focusedPageIsVisible ? focusedPage : undefined;
}

export function createEmptyPage(options: {
  documentId: string;
  order: number;
  sectionId?: string;
  dividerId?: string;
  paperType: PaperType;
  paperColor: string;
  patternColor?: string;
  patternOpacity?: number;
  patternSize?: number;
  paperTexture?: PaperTexture;
  textureIntensity?: number;
  margins?: PaperMargins;
  appearance?: Partial<PaperAppearance>;
  title?: string;
}): Page {
  const createdAt = timestamp();
  const appearance = normalizePaperAppearance({
    ...options.appearance,
    paperType: options.appearance?.paperType ?? options.paperType,
    paperColor: options.appearance?.paperColor ?? options.paperColor,
    patternColor: options.appearance?.patternColor ?? options.patternColor,
    patternOpacity: options.appearance?.patternOpacity ?? options.patternOpacity,
    patternSize:
      options.appearance?.patternSize ??
      options.patternSize ??
      getDefaultPatternSize(options.paperType),
    paperTexture: options.appearance?.paperTexture ?? options.paperTexture,
    textureIntensity: options.appearance?.textureIntensity ?? options.textureIntensity,
    margins: options.appearance?.margins ?? options.margins,
  });

  return {
    id: createId("page"),
    documentId: options.documentId,
    sectionId: options.sectionId,
    dividerId: options.dividerId,
    title: options.title,
    order: options.order,

    ...appearance,
    margins: { ...appearance.margins },

    elements: [],
    createdAt,
    updatedAt: createdAt,
  };
}
export function createEmptyDocument(type: DocumentType): MoctesDocument {
  const createdAt = timestamp();
  const documentId = createId("doc");
  const page = createEmptyPage({
    documentId,
    order: 1,
    paperType: "dotted",
    paperColor: type === "clipboard" ? "#f7fcff" : "#fffdf8",
    title: "Nova página",
  });
  const defaultPaperAppearance = getPageAppearance(page);

  const document: MoctesDocument = {
    id: documentId,
    type,
    title:
      type === "notebook"
        ? "Novo caderno"
        : type === "notepad"
          ? "Novo bloco"
          : "Nova prancheta",
    coverColor: type === "clipboard" ? "#c8b4e6" : "#bde4eb",
    coverBorderColor: "#8dcbd7",
    spineColor: "#bdeff3",
    leftTabColor: "rgba(72, 73, 79, 0.62)",
    rightTabColor: "rgba(181, 222, 230, 0.76)",
    clipboardColor: type === "clipboard" ? "#c8b4e6" : undefined,
    favorite: false,
    pages: [page],
    defaultPaperAppearance,
    paperTemplates: [],
    dividers: [],
    activePageId: page.id,
    createdAt,
    updatedAt: createdAt,
  };

  return type === "notebook" ? migrateDocumentToSchemaV3(document) : document;
}

export function clonePage(page: Page, overrides: Partial<Page> = {}): Page {
  const createdAt = timestamp();
  const id = overrides.id ?? createId("page");

  return {
    ...page,
    ...overrides,
    id,
    elements: page.elements.map((element) => cloneElement(element)),
    createdAt,
    updatedAt: createdAt,
  };
}

export function cloneElement(element: PageElement): PageElement {
  return {
    ...element,
    id: createId("el"),
    x: Math.min(100 - element.width, element.x + 3),
    y: Math.min(100 - element.height, element.y + 3),
    zIndex: element.zIndex + 1,
    content: structuredClone(element.content),
    style: {
      text: element.style.text ? { ...element.style.text } : undefined,
      box: element.style.box ? { ...element.style.box } : undefined,
      image: element.style.image ? { ...element.style.image } : undefined,
    },
  };
}

export function normalizePageOrder(pages: Page[]): Page[] {
  return getSortedByOrder(pages).map((page, index) => ({
    ...page,
    order: index + 1,
  }));
}

export function getSortedByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((first, second) => first.order - second.order);
}

export function createDivider(options: {
  documentId: string;
  order: number;
  name?: string;
  color?: string;
}): Divider {
  return {
    id: createId("divider"),
    documentId: options.documentId,
    name: options.name ?? "Nova divisória",
    color: options.color ?? "#d9f4f7",
    order: options.order,
  };
}
