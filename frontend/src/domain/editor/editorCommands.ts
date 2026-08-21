import type { Divider, MoctesDocument } from "../../types/document.types";
import type { PageElement } from "../../types/element.types";
import type { Page } from "../../types/page.types";
import { normalizePageOrder } from "../../utils/document.utils";
import { createHistoryEntry, type HistoryEntry } from "../../utils/history.utils";
import { reconcileNotebookDocument } from "../../utils/notebookMigration.utils";

export type LayerDirection = "front" | "back" | "forward" | "backward";

export type EditorCommand =
  | { type: "document/insert"; document: MoctesDocument }
  | { type: "document/remove"; documentId: string }
  | {
      type: "document/update";
      documentId: string;
      updates: Partial<MoctesDocument>;
      updatedAt: string;
    }
  | { type: "document/replace"; documentId: string; document: MoctesDocument; label: string }
  | { type: "page/insert"; documentId: string; page: Page; updatedAt: string }
  | { type: "page/remove"; pageId: string; updatedAt: string }
  | { type: "page/update"; pageId: string; updates: Partial<Page>; updatedAt: string }
  | { type: "pages/reorder"; documentId: string; pageIds: string[]; updatedAt: string }
  | {
      type: "page/move-divider";
      pageId: string;
      dividerId: string | null;
      updatedAt: string;
    }
  | { type: "divider/insert"; documentId: string; divider: Divider; updatedAt: string }
  | {
      type: "divider/update";
      dividerId: string;
      updates: Partial<Divider>;
      updatedAt: string;
    }
  | { type: "divider/remove"; dividerId: string; updatedAt: string }
  | { type: "element/insert"; pageId: string; element: PageElement; updatedAt: string }
  | {
      type: "element/update";
      elementId: string;
      updates: Partial<PageElement>;
      updatedAt: string;
    }
  | {
      type: "element/update-style";
      elementId: string;
      updates: Partial<PageElement["style"]>;
      updatedAt: string;
    }
  | { type: "element/remove"; elementId: string; updatedAt: string }
  | {
      type: "element/move";
      elementId: string;
      sourcePageId: string;
      targetPageId: string;
      x: number;
      y: number;
      updatedAt: string;
    }
  | {
      type: "element/layer";
      elementId: string;
      direction: LayerDirection;
      updatedAt: string;
    }
  | {
      type: "page/replace-elements";
      pageId: string;
      elements: PageElement[];
      updatedAt: string;
    };

export interface EditorCommandExecution {
  documents: MoctesDocument[];
  historyEntry: HistoryEntry | null;
  changed: boolean;
}

export function executeEditorCommand(
  documents: MoctesDocument[],
  command: EditorCommand,
): EditorCommandExecution {
  const nextDocuments = reduceEditorCommand(documents, command);
  const historyEntry = createHistoryEntry(documents, nextDocuments, getCommandLabel(command));
  return {
    documents: historyEntry ? nextDocuments : documents,
    historyEntry,
    changed: Boolean(historyEntry),
  };
}

export function reduceEditorCommand(
  documents: MoctesDocument[],
  command: EditorCommand,
): MoctesDocument[] {
  switch (command.type) {
    case "document/insert":
      return documents.some((document) => document.id === command.document.id)
        ? documents
        : [...documents, syncDocument(command.document)];
    case "document/remove":
      return documents.filter((document) => document.id !== command.documentId);
    case "document/update":
      return mapDocument(documents, command.documentId, (document) => ({
        ...document,
        ...command.updates,
        id: document.id,
        updatedAt: command.updatedAt,
      }));
    case "document/replace":
      return mapDocument(documents, command.documentId, () => ({
        ...command.document,
        id: command.documentId,
      }));
    case "page/insert":
      return mapDocument(documents, command.documentId, (document) => ({
        ...document,
        pages: normalizePageOrder([...document.pages, command.page]),
        activePageId: command.page.id,
        activeSurfaceId: document.type === "notebook" ? command.page.id : document.activeSurfaceId,
        updatedAt: command.updatedAt,
      }));
    case "page/remove":
      return documents.map((document) => {
        const page = document.pages.find((item) => item.id === command.pageId);
        if (!page || document.pages.length <= 1) {
          return document;
        }
        const pages = normalizePageOrder(
          document.pages.filter((item) => item.id !== command.pageId),
        );
        const activePageId = document.activePageId === command.pageId
          ? pages[0].id
          : document.activePageId;
        return syncDocument({
          ...document,
          pages,
          activePageId,
          activeSurfaceId:
            document.activeSurfaceId === command.pageId
              ? activePageId
              : document.activeSurfaceId,
          updatedAt: command.updatedAt,
        });
      });
    case "page/update":
      return mapPage(documents, command.pageId, (page) => ({
        ...page,
        ...command.updates,
        id: page.id,
        documentId: page.documentId,
        elements: command.updates.elements ?? page.elements,
        updatedAt: command.updatedAt,
      }), command.updatedAt);
    case "pages/reorder": {
      const orderById = new Map(command.pageIds.map((pageId, index) => [pageId, index + 1]));
      return mapDocument(documents, command.documentId, (document) => ({
        ...document,
        pages: normalizePageOrder(
          document.pages.map((page) => ({
            ...page,
            order: orderById.get(page.id) ?? page.order,
          })),
        ),
        updatedAt: command.updatedAt,
      }));
    }
    case "page/move-divider":
      return mapPage(documents, command.pageId, (page, document) => {
        const sectionId = document.sections?.find(
          (section) => section.divider.id === command.dividerId,
        )?.id;
        return {
          ...page,
          sectionId: sectionId ?? page.sectionId,
          dividerId: document.type === "notebook"
            ? undefined
            : command.dividerId ?? undefined,
          updatedAt: command.updatedAt,
        };
      }, command.updatedAt);
    case "divider/insert":
      return mapDocument(documents, command.documentId, (document) => ({
        ...document,
        dividers: [...document.dividers, command.divider],
        updatedAt: command.updatedAt,
      }));
    case "divider/update":
      return documents.map((document) => {
        if (!document.dividers.some((divider) => divider.id === command.dividerId)) {
          return document;
        }
        return syncDocument({
          ...document,
          dividers: document.dividers.map((divider) =>
            divider.id === command.dividerId
              ? {
                  ...divider,
                  ...command.updates,
                  id: divider.id,
                  documentId: divider.documentId,
                }
              : divider,
          ),
          updatedAt: command.updatedAt,
        });
      });
    case "divider/remove":
      return documents.map((document) => {
        if (!document.dividers.some((divider) => divider.id === command.dividerId)) {
          return document;
        }
        return syncDocument({
          ...document,
          dividers: document.dividers.filter((divider) => divider.id !== command.dividerId),
          pages: document.pages.map((page) =>
            page.dividerId === command.dividerId ? { ...page, dividerId: undefined } : page,
          ),
          updatedAt: command.updatedAt,
        });
      });
    case "element/insert":
      return mapPage(documents, command.pageId, (page) => ({
        ...page,
        elements: normalizeZIndexes([...page.elements, command.element]),
        updatedAt: command.updatedAt,
      }), command.updatedAt);
    case "element/update":
      return mapElement(documents, command.elementId, (element) => ({
        ...element,
        ...command.updates,
        id: element.id,
        content: command.updates.content ?? element.content,
        style: command.updates.style ?? element.style,
      }), command.updatedAt);
    case "element/update-style":
      return mapElement(documents, command.elementId, (element) =>
        element.locked
          ? element
          : {
              ...element,
              style: {
                text: command.updates.text ?? element.style.text,
                box: command.updates.box ?? element.style.box,
                image: command.updates.image ?? element.style.image,
              },
            }, command.updatedAt);
    case "element/remove":
      return documents.map((document) => {
        const element = findElement(document, command.elementId);
        if (!element || element.locked) {
          return document;
        }
        return syncDocument({
          ...document,
          pages: document.pages.map((page) =>
            page.elements.some((item) => item.id === command.elementId)
              ? {
                  ...page,
                  elements: normalizeZIndexes(
                    page.elements.filter((item) => item.id !== command.elementId),
                  ),
                  updatedAt: command.updatedAt,
                }
              : page,
          ),
          updatedAt: command.updatedAt,
        });
      });
    case "element/move":
      return moveElement(documents, command);
    case "element/layer":
      return updateElementLayer(documents, command);
    case "page/replace-elements":
      return mapPage(documents, command.pageId, (page) => ({
        ...page,
        elements: normalizeZIndexes(command.elements),
        updatedAt: command.updatedAt,
      }), command.updatedAt);
  }
}

function mapDocument(
  documents: MoctesDocument[],
  documentId: string,
  update: (document: MoctesDocument) => MoctesDocument,
): MoctesDocument[] {
  return documents.map((document) =>
    document.id === documentId ? syncDocument(update(document)) : document,
  );
}

function mapPage(
  documents: MoctesDocument[],
  pageId: string,
  update: (page: Page, document: MoctesDocument) => Page,
  updatedAt: string,
): MoctesDocument[] {
  return documents.map((document) => {
    if (!document.pages.some((page) => page.id === pageId)) {
      return document;
    }
    return syncDocument({
      ...document,
      pages: document.pages.map((page) =>
        page.id === pageId ? update(page, document) : page,
      ),
      updatedAt,
    });
  });
}

function mapElement(
  documents: MoctesDocument[],
  elementId: string,
  update: (element: PageElement) => PageElement,
  updatedAt: string,
): MoctesDocument[] {
  return documents.map((document) => {
    const containingPage = document.pages.find((page) =>
      page.elements.some((element) => element.id === elementId),
    );
    if (!containingPage) {
      return document;
    }
    return syncDocument({
      ...document,
      pages: document.pages.map((page) =>
        page.id === containingPage.id
          ? {
              ...page,
              elements: page.elements.map((element) =>
                element.id === elementId ? update(element) : element,
              ),
              updatedAt,
            }
          : page,
      ),
      updatedAt,
    });
  });
}

function moveElement(
  documents: MoctesDocument[],
  command: Extract<EditorCommand, { type: "element/move" }>,
): MoctesDocument[] {
  return documents.map((document) => {
    const sourcePage = document.pages.find((page) => page.id === command.sourcePageId);
    const targetPage = document.pages.find((page) => page.id === command.targetPageId);
    const element = sourcePage?.elements.find((item) => item.id === command.elementId);
    if (!sourcePage || !targetPage || !element || element.locked) {
      return document;
    }

    if (sourcePage.id === targetPage.id) {
      return syncDocument({
        ...document,
        pages: document.pages.map((page) =>
          page.id === sourcePage.id
            ? {
                ...page,
                elements: page.elements.map((item) =>
                  item.id === element.id
                    ? { ...item, x: command.x, y: command.y }
                    : item,
                ),
                updatedAt: command.updatedAt,
              }
            : page,
        ),
        updatedAt: command.updatedAt,
      });
    }

    const movingElement = { ...element, x: command.x, y: command.y };
    return syncDocument({
      ...document,
      pages: document.pages.map((page) => {
        if (page.id === sourcePage.id) {
          return {
            ...page,
            elements: normalizeZIndexes(
              page.elements.filter((item) => item.id !== element.id),
            ),
            updatedAt: command.updatedAt,
          };
        }
        if (page.id === targetPage.id) {
          return {
            ...page,
            elements: normalizeZIndexes([...page.elements, movingElement]),
            updatedAt: command.updatedAt,
          };
        }
        return page;
      }),
      activePageId: targetPage.id,
      updatedAt: command.updatedAt,
    });
  });
}

function updateElementLayer(
  documents: MoctesDocument[],
  command: Extract<EditorCommand, { type: "element/layer" }>,
): MoctesDocument[] {
  return documents.map((document) => {
    const page = document.pages.find((item) =>
      item.elements.some((element) => element.id === command.elementId),
    );
    const element = page?.elements.find((item) => item.id === command.elementId);
    if (!page || !element || element.locked) {
      return document;
    }

    const ordered = normalizeZIndexes(page.elements);
    const index = ordered.findIndex((item) => item.id === command.elementId);
    const next = [...ordered];
    const [target] = next.splice(index, 1);
    const targetIndex = command.direction === "front"
      ? next.length
      : command.direction === "back"
        ? 0
        : command.direction === "forward"
          ? Math.min(next.length, index + 1)
          : Math.max(0, index - 1);
    next.splice(targetIndex, 0, target);

    return syncDocument({
      ...document,
      pages: document.pages.map((item) =>
        item.id === page.id
          ? { ...item, elements: assignZIndexes(next), updatedAt: command.updatedAt }
          : item,
      ),
      updatedAt: command.updatedAt,
    });
  });
}

function findElement(
  document: MoctesDocument,
  elementId: string,
): PageElement | undefined {
  return document.pages
    .flatMap((page) => page.elements)
    .find((element) => element.id === elementId);
}

function normalizeZIndexes(elements: PageElement[]): PageElement[] {
  return [...elements]
    .sort((first, second) => first.zIndex - second.zIndex)
    .map((element, index) => ({ ...element, zIndex: index + 1 }));
}

function assignZIndexes(elements: PageElement[]): PageElement[] {
  return elements.map((element, index) => ({ ...element, zIndex: index + 1 }));
}

function syncDocument(document: MoctesDocument): MoctesDocument {
  return document.type === "notebook" ? reconcileNotebookDocument(document) : document;
}

function getCommandLabel(command: EditorCommand): string {
  if (command.type === "document/replace") {
    return command.label;
  }
  return command.type;
}
