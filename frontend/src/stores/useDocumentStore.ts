import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { initialDocuments } from "../data/initialDocuments";
import {
  executeEditorCommand,
  type EditorCommand,
} from "../domain/editor/editorCommands";
import {
  getSectionInsertionOrder,
  insertNotebookPage,
  insertNotebookSection,
  moveNotebookPage,
  removeNotebookPage,
  removeNotebookSection,
  renameNotebookSection,
  reorderNotebookPages,
  reorderNotebookSections,
  updateNotebookSectionDivider,
} from "../domain/editor/notebookDocumentCommands";
import type {
  Divider,
  DocumentType,
  MoctesDocument,
} from "../types/document.types";
import type { PageElement } from "../types/element.types";
import type {
  AddNotebookSectionOptions,
  NotebookDividerUpdate,
  RemoveSectionStrategy,
} from "../types/notebook.types";
import type { Page } from "../types/page.types";
import type { CreatePageFromTemplateOptions } from "../types/pageTemplate.types";
import { DEFAULT_SAFE_AREA } from "../utils/coordinates.utils";
import { normalizeAssetElementContent } from "../utils/assetReferenceMigration.utils";
import {
  cloneElement,
  clonePage,
  createDivider as createDividerModel,
  createEmptyDocument,
  createEmptyPage,
  getActivePage,
  normalizePageOrder,
  timestamp,
} from "../utils/document.utils";
import { placeElementForInsertion } from "../utils/insertion.utils";
import {
  createDefaultNotebookSection,
  reconcileNotebookDocument,
} from "../utils/notebookMigration.utils";
import {
  buildNotebookSurfaces,
  getPagesInSection,
  getSurfaceById,
} from "../utils/notebookSurfaces.utils";
import { normalizePostItContent } from "../utils/postIt.utils";
import { normalizeShapeAppearance } from "../utils/shape.utils";
import { normalizeTapeContent } from "../utils/tape.utils";
import { normalizeChecklistContent } from "../utils/checklist.utils";
import {
  DEFAULT_PAPER_APPEARANCE,
  getPageAppearance,
  normalizePaperAppearance,
  normalizePaperTemplate,
} from "../utils/paperAppearance.utils";
import { useEditorStore } from "./useEditorStore";
import { getDocumentStoreStorage } from "../performance/performanceLabEnvironment";
import { instantiatePageTemplate } from "../data/pageTemplates";

interface DocumentStoreState {
  documents: MoctesDocument[];
  activeDocumentId: string;
  activePageId: string;
  activeDividerId: string | null;
  selectedElementId: string | null;
  setActiveDocument: (documentId: string) => void;
  setActivePage: (pageId: string) => void;
  createDocument: (type: DocumentType) => string;
  updateDocument: (
    documentId: string,
    updates: Partial<MoctesDocument>,
  ) => void;
  deleteDocument: (documentId: string) => void;
  createPage: (documentId?: string) => string | null;
  createPageFromTemplate: (options: CreatePageFromTemplateOptions) => string | null;
  updatePage: (pageId: string, updates: Partial<Page>) => void;
  deletePage: (pageId: string) => void;
  duplicatePage: (pageId: string) => string | null;
  createDivider: (documentId?: string, name?: string) => string | null;
  updateDivider: (dividerId: string, updates: Partial<Divider>) => void;
  deleteDivider: (dividerId: string) => void;
  addElement: (pageId: string, element: PageElement) => void;
  moveElementToPage: (options: {
    elementId: string;
    sourcePageId: string;
    targetPageId: string;
    x: number;
    y: number;
  }) => void;
  updateElement: (elementId: string, updates: Partial<PageElement>) => void;
  updateElementStyle: (
    elementId: string,
    updates: Partial<PageElement["style"]>,
  ) => void;
  deleteElement: (elementId: string) => void;
  duplicateElement: (elementId: string) => string | null;
  pasteElement: (pageId: string, element: PageElement) => string;
  toggleElementLock: (elementId: string) => void;
  toggleElementVisibility: (elementId: string) => void;
  bringElementToFront: (elementId: string) => void;
  sendElementToBack: (elementId: string) => void;
  moveElementForward: (elementId: string) => void;
  moveElementBackward: (elementId: string) => void;
  selectElement: (elementId: string) => void;
  clearSelection: () => void;
  reorderPages: (documentId: string, pageIds: string[]) => void;
  movePageToDivider: (pageId: string, dividerId: string | null) => void;
  addSection: (
    documentId?: string,
    options?: AddNotebookSectionOptions,
  ) => string | null;
  removeSection: (
    documentId: string | undefined,
    sectionId: string,
    strategy: RemoveSectionStrategy,
  ) => boolean;
  renameSection: (
    documentId: string | undefined,
    sectionId: string,
    title: string,
  ) => boolean;
  reorderSections: (
    documentId: string | undefined,
    fromIndex: number,
    toIndex: number,
  ) => boolean;
  updateNotebookDivider: (
    documentId: string | undefined,
    sectionId: string,
    updates: NotebookDividerUpdate,
  ) => boolean;
  updateDividerColor: (
    documentId: string | undefined,
    sectionId: string,
    color: string,
  ) => boolean;
  updateDividerTabColor: (
    documentId: string | undefined,
    sectionId: string,
    color: string,
  ) => boolean;
  updateDividerTextColor: (
    documentId: string | undefined,
    sectionId: string,
    color: string,
  ) => boolean;
  updateDividerTabPosition: (
    documentId: string | undefined,
    sectionId: string,
    position: number,
  ) => boolean;
  addPageToSection: (
    documentId: string | undefined,
    sectionId: string,
    index?: number,
  ) => string | null;
  movePageToSection: (
    documentId: string | undefined,
    pageId: string,
    targetSectionId: string,
    index?: number,
  ) => boolean;
  removePageFromSection: (
    documentId: string | undefined,
    pageId: string,
  ) => boolean;
  reorderPagesWithinSection: (
    documentId: string | undefined,
    sectionId: string,
    fromIndex: number,
    toIndex: number,
  ) => boolean;
  setActiveSurface: (surfaceId: string, documentId?: string) => boolean;
  goToNextSurface: (documentId?: string) => boolean;
  goToPreviousSurface: (documentId?: string) => boolean;
  goToFirstSurface: (documentId?: string) => boolean;
  goToLastSurface: (documentId?: string) => boolean;
  goToSection: (sectionId: string, documentId?: string) => boolean;
  goToPage: (pageId: string, documentId?: string) => boolean;
  toggleFavoriteActiveDocument: () => void;
  clearActivePageElements: () => void;
  applyDocumentsSnapshot: (documents: MoctesDocument[]) => void;
  restoreDemoDocuments: (identityScope?: string) => void;
}

type PersistedDocumentState = Pick<
  DocumentStoreState,
  | "documents"
  | "activeDocumentId"
  | "activePageId"
  | "activeDividerId"
  | "selectedElementId"
>;

const firstDocument = initialDocuments[0];

const fallbackState: PersistedDocumentState = {
  documents: initialDocuments.map((document) => syncDocument(document)),
  activeDocumentId: firstDocument.id,
  activePageId: firstDocument.activePageId,
  activeDividerId: firstDocument.dividers[0]?.id ?? null,
  selectedElementId: null,
};

export const useDocumentStore = create<DocumentStoreState>()(
  persist<DocumentStoreState, [], [], PersistedDocumentState>(
    (set, get) => {
      const dispatchCommand = (
        command: EditorCommand,
        extras: Partial<DocumentStoreState> = {},
      ): boolean => {
        const execution = executeEditorCommand(get().documents, command);
        if (!execution.changed || !execution.historyEntry) {
          return false;
        }

        set({ documents: execution.documents, ...extras });
        useEditorStore.getState().recordHistoryEntry(execution.historyEntry);
        return true;
      };

      const commitStructuralChange = (
        documentId: string | undefined,
        update: (document: MoctesDocument) => MoctesDocument | null,
        extras: Partial<DocumentStoreState> = {},
      ): boolean => {
        const targetDocumentId = documentId ?? get().activeDocumentId;
        const document = get().documents.find(
          (item) => item.id === targetDocumentId,
        );
        if (!document) {
          return false;
        }
        const updated = update(document);
        return updated
          ? dispatchCommand(
              {
                type: "document/replace",
                documentId: targetDocumentId,
                document: syncDocument(updated),
                label: "notebook/structural-change",
              },
              extras,
            )
          : false;
      };

      const navigateToSurface = (
        documentId: string | undefined,
        surfaceId: string,
      ): boolean => {
        const targetDocumentId = documentId ?? get().activeDocumentId;
        let didNavigate = false;

        set((state) => {
          const document = state.documents.find(
            (item) => item.id === targetDocumentId,
          );
          if (!document) {
            return state;
          }

          const reconciled = syncDocument(document);
          const surface = getSurfaceById(reconciled, surfaceId);
          if (!surface) {
            return state;
          }

          const activePageId =
            surface.kind === "page"
              ? surface.page.id
              : reconciled.pages.some(
                    (page) => page.id === reconciled.activePageId,
                  )
                ? reconciled.activePageId
                : (reconciled.pages[0]?.id ?? state.activePageId);

          didNavigate =
            reconciled.activeSurfaceId !== surface.id ||
            reconciled.activePageId !== activePageId ||
            state.activePageId !== activePageId;

          if (!didNavigate) {
            return state;
          }

          const nextDocument = syncDocument({
            ...reconciled,
            activeSurfaceId: surface.id,
            activePageId,
            updatedAt: timestamp(),
          });

          return {
            documents: state.documents.map((item) =>
              item.id === targetDocumentId ? nextDocument : item,
            ),
            activeDocumentId: targetDocumentId,
            activePageId,
            activeDividerId:
              surface.kind === "divider" ? surface.id : state.activeDividerId,
            selectedElementId: null,
          };
        });

        return didNavigate;
      };

      return {
        ...fallbackState,
        setActiveDocument: (documentId) =>
          set((state) => {
            const document = state.documents.find(
              (item) => item.id === documentId,
            );
            if (!document) {
              return state;
            }

            return {
              activeDocumentId: document.id,
              activePageId: document.activePageId,
              activeDividerId: document.dividers[0]?.id ?? null,
              selectedElementId: null,
            };
          }),
        setActivePage: (pageId) =>
          set((state) =>
            updateDocuments(
              state,
              (document) => {
                const page = document.pages.find((item) => item.id === pageId);
                if (!page) {
                  return document;
                }

                return {
                  ...document,
                  activePageId: page.id,
                  activeSurfaceId:
                    document.type === "notebook"
                      ? document.activeSurfaceId
                      : page.id,
                  updatedAt: timestamp(),
                };
              },
              { activePageId: pageId, selectedElementId: null },
            ),
          ),
        createDocument: (type) => {
          const document = createEmptyDocument(type);
          dispatchCommand(
            { type: "document/insert", document },
            {
              activeDocumentId: document.id,
              activePageId: document.activePageId,
              activeDividerId: null,
              selectedElementId: null,
            },
          );
          return document.id;
        },
        updateDocument: (documentId, updates) =>
          void dispatchCommand({
            type: "document/update",
            documentId,
            updates,
            updatedAt: timestamp(),
          }),
        deleteDocument: (documentId) => {
          const state = get();
          if (state.documents.length <= 1) {
            return;
          }
          const remaining = state.documents.filter(
            (document) => document.id !== documentId,
          );
          const activeDocument =
            state.activeDocumentId === documentId
              ? remaining[0]
              : (remaining.find(
                  (document) => document.id === state.activeDocumentId,
                ) ?? remaining[0]);
          dispatchCommand(
            { type: "document/remove", documentId },
            {
              activeDocumentId: activeDocument.id,
              activePageId: activeDocument.activePageId,
              activeDividerId: activeDocument.dividers[0]?.id ?? null,
              selectedElementId: null,
            },
          );
        },
        createPage: (documentId) => {
          const targetDocumentId = documentId ?? get().activeDocumentId;
          const document = get().documents.find(
            (item) => item.id === targetDocumentId,
          );
          if (!document) {
            return null;
          }
          const activePage = getActivePage(document);
          const inheritedAppearance = document.defaultPaperAppearance
            ? normalizePaperAppearance(document.defaultPaperAppearance)
            : activePage
              ? getPageAppearance(activePage)
              : DEFAULT_PAPER_APPEARANCE;
          const page = createEmptyPage({
            documentId: document.id,
            sectionId: activePage?.sectionId,
            dividerId: activePage?.dividerId,
            order: document.pages.length + 1,
            paperType: inheritedAppearance.paperType,
            paperColor: inheritedAppearance.paperColor,
            appearance: inheritedAppearance,
            title: "Nova página",
          });
          const changed = dispatchCommand(
            {
              type: "page/insert",
              documentId: document.id,
              page,
              updatedAt: timestamp(),
            },
            {
              activeDocumentId: targetDocumentId,
              activePageId: page.id,
              selectedElementId: null,
            },
          );
          return changed ? page.id : null;
        },
        createPageFromTemplate: ({ templateId, documentId, sectionId }) => {
          const targetDocumentId = documentId ?? get().activeDocumentId;
          const document = get().documents.find((item) => item.id === targetDocumentId);
          if (!document) return null;

          const activePage = getActivePage(document);
          const baseAppearance = document.defaultPaperAppearance
            ? normalizePaperAppearance(document.defaultPaperAppearance)
            : activePage
              ? getPageAppearance(activePage)
              : DEFAULT_PAPER_APPEARANCE;
          const template = instantiatePageTemplate(templateId, baseAppearance);

          if (document.type === "notebook") {
            const notebook = syncDocument(document);
            const targetSectionId =
              sectionId ??
              activePage?.sectionId ??
              notebook.sections?.[0]?.id;
            const section = notebook.sections?.find((item) => item.id === targetSectionId);
            if (!section) return null;
            const page = {
              ...createEmptyPage({
                documentId: notebook.id,
                sectionId: section.id,
                order: getSectionInsertionOrder(getPagesInSection(notebook, section.id)),
                paperType: template.appearance.paperType,
                paperColor: template.appearance.paperColor,
                appearance: template.appearance,
                title: template.title,
              }),
              elements: template.elements,
            };
            const changed = commitStructuralChange(targetDocumentId, (current) =>
              insertNotebookPage(current, page, timestamp()),
            );
            if (changed) {
              set({
                activeDocumentId: targetDocumentId,
                activePageId: page.id,
                selectedElementId: null,
              });
            }
            return changed ? page.id : null;
          }

          const page = {
            ...createEmptyPage({
              documentId: document.id,
              order: document.pages.length + 1,
              paperType: template.appearance.paperType,
              paperColor: template.appearance.paperColor,
              appearance: template.appearance,
              title: template.title,
            }),
            elements: template.elements,
          };
          const changed = dispatchCommand(
            {
              type: "page/insert",
              documentId: document.id,
              page,
              updatedAt: timestamp(),
            },
            {
              activeDocumentId: targetDocumentId,
              activePageId: page.id,
              selectedElementId: null,
            },
          );
          return changed ? page.id : null;
        },
        updatePage: (pageId, updates) =>
          void dispatchCommand({
            type: "page/update",
            pageId,
            updates,
            updatedAt: timestamp(),
          }),
        deletePage: (pageId) => {
          const state = get();
          const document = state.documents.find((item) =>
            item.pages.some((page) => page.id === pageId),
          );
          const nextActivePageId =
            document?.activePageId === pageId
              ? (document.pages.find((page) => page.id !== pageId)?.id ??
                state.activePageId)
              : state.activePageId;
          dispatchCommand(
            { type: "page/remove", pageId, updatedAt: timestamp() },
            {
              activePageId: nextActivePageId,
              selectedElementId: null,
            },
          );
        },
        duplicatePage: (pageId) => {
          const document = get().documents.find((item) =>
            item.pages.some((page) => page.id === pageId),
          );
          const page = document?.pages.find((item) => item.id === pageId);
          if (!document || !page) {
            return null;
          }
          const duplicatedPage = clonePage(page, {
            order: page.order + 0.5,
            title: page.title ? `${page.title} cópia` : "Página cópia",
          });
          const changed = dispatchCommand(
            {
              type: "page/insert",
              documentId: document.id,
              page: duplicatedPage,
              updatedAt: timestamp(),
            },
            { activePageId: duplicatedPage.id, selectedElementId: null },
          );
          return changed ? duplicatedPage.id : null;
        },
        createDivider: (documentId, name) => {
          const targetDocumentId = documentId ?? get().activeDocumentId;
          const document = get().documents.find(
            (item) => item.id === targetDocumentId,
          );
          if (!document) {
            return null;
          }
          const divider = createDividerModel({
            documentId: document.id,
            name,
            order: document.dividers.length + 1,
          });
          const changed = dispatchCommand(
            {
              type: "divider/insert",
              documentId: document.id,
              divider,
              updatedAt: timestamp(),
            },
            { activeDividerId: divider.id },
          );
          return changed ? divider.id : null;
        },
        updateDivider: (dividerId, updates) =>
          void dispatchCommand({
            type: "divider/update",
            dividerId,
            updates,
            updatedAt: timestamp(),
          }),
        deleteDivider: (dividerId) =>
          void dispatchCommand(
            {
              type: "divider/remove",
              dividerId,
              updatedAt: timestamp(),
            },
            {
              activeDividerId:
                get().activeDividerId === dividerId
                  ? null
                  : get().activeDividerId,
            },
          ),
        addElement: (pageId, element) =>
          void dispatchCommand(
            {
              type: "element/insert",
              pageId,
              element,
              updatedAt: timestamp(),
            },
            { selectedElementId: element.id },
          ),
        moveElementToPage: ({ elementId, sourcePageId, targetPageId, x, y }) =>
          void dispatchCommand(
            {
              type: "element/move",
              elementId,
              sourcePageId,
              targetPageId,
              x,
              y,
              updatedAt: timestamp(),
            },
            { activePageId: targetPageId, selectedElementId: elementId },
          ),
        updateElement: (elementId, updates) =>
          void dispatchCommand({
            type: "element/update",
            elementId,
            updates,
            updatedAt: timestamp(),
          }),
        updateElementStyle: (elementId, updates) =>
          void dispatchCommand({
            type: "element/update-style",
            elementId,
            updates,
            updatedAt: timestamp(),
          }),
        deleteElement: (elementId) =>
          void dispatchCommand(
            {
              type: "element/remove",
              elementId,
              updatedAt: timestamp(),
            },
            {
              selectedElementId:
                get().selectedElementId === elementId
                  ? null
                  : get().selectedElementId,
            },
          ),
        duplicateElement: (elementId) => {
          const page = get()
            .documents.flatMap((document) => document.pages)
            .find((item) =>
              item.elements.some((element) => element.id === elementId),
            );
          const element = page?.elements.find((item) => item.id === elementId);
          if (!page || !element) {
            return null;
          }
          const duplicatedElement = placeElementForInsertion({
            element: cloneElement(element),
            existingElements: page.elements,
            safeArea: DEFAULT_SAFE_AREA,
          });
          const changed = dispatchCommand(
            {
              type: "element/insert",
              pageId: page.id,
              element: duplicatedElement,
              updatedAt: timestamp(),
            },
            { selectedElementId: duplicatedElement.id },
          );
          return changed ? duplicatedElement.id : null;
        },
        pasteElement: (pageId, element) => {
          const existingElements =
            get()
              .documents.flatMap((document) => document.pages)
              .find((page) => page.id === pageId)?.elements ?? [];
          const pastedElement = placeElementForInsertion({
            element: { ...cloneElement(element), zIndex: 999 },
            existingElements,
            safeArea: DEFAULT_SAFE_AREA,
          });
          dispatchCommand(
            {
              type: "element/insert",
              pageId,
              element: pastedElement,
              updatedAt: timestamp(),
            },
            { selectedElementId: pastedElement.id },
          );
          return pastedElement.id;
        },
        toggleElementLock: (elementId) => {
          const element = findElement(get().documents, elementId);
          if (element) {
            dispatchCommand({
              type: "element/update",
              elementId,
              updates: { locked: !element.locked },
              updatedAt: timestamp(),
            });
          }
        },
        toggleElementVisibility: (elementId) => {
          const element = findElement(get().documents, elementId);
          if (element) {
            dispatchCommand({
              type: "element/update",
              elementId,
              updates: { hidden: !element.hidden },
              updatedAt: timestamp(),
            });
          }
        },
        bringElementToFront: (elementId) =>
          void dispatchCommand({
            type: "element/layer",
            elementId,
            direction: "front",
            updatedAt: timestamp(),
          }),
        sendElementToBack: (elementId) =>
          void dispatchCommand({
            type: "element/layer",
            elementId,
            direction: "back",
            updatedAt: timestamp(),
          }),
        moveElementForward: (elementId) =>
          void dispatchCommand({
            type: "element/layer",
            elementId,
            direction: "forward",
            updatedAt: timestamp(),
          }),
        moveElementBackward: (elementId) =>
          void dispatchCommand({
            type: "element/layer",
            elementId,
            direction: "backward",
            updatedAt: timestamp(),
          }),
        selectElement: (selectedElementId) => set({ selectedElementId }),
        clearSelection: () => set({ selectedElementId: null }),
        reorderPages: (documentId, pageIds) =>
          void dispatchCommand({
            type: "pages/reorder",
            documentId,
            pageIds,
            updatedAt: timestamp(),
          }),
        movePageToDivider: (pageId, dividerId) =>
          void dispatchCommand(
            {
              type: "page/move-divider",
              pageId,
              dividerId,
              updatedAt: timestamp(),
            },
            { activeDividerId: dividerId },
          ),
        addSection: (documentId, options = {}) => {
          const targetDocumentId = documentId ?? get().activeDocumentId;
          const document = get().documents.find(
            (item) => item.id === targetDocumentId,
          );
          if (!document || document.type !== "notebook") {
            return null;
          }
          const notebook = syncDocument(document);
          const section = createDefaultNotebookSection({
            title: options.title?.trim() || undefined,
            tabPosition: notebook.sections?.length ?? 0,
          });
          section.divider.color = options.color ?? section.divider.color;
          section.divider.tabColor = options.color ?? section.divider.tabColor;
          const page =
            options.createInitialPage === false
              ? null
              : createEmptyPage({
                  documentId: notebook.id,
                  sectionId: section.id,
                  order: notebook.pages.length + 1,
                  paperType:
                    notebook.defaultPaperAppearance?.paperType ??
                    notebook.pages[0]?.paperType ??
                    "dotted",
                  paperColor:
                    notebook.defaultPaperAppearance?.paperColor ??
                    notebook.pages[0]?.paperColor ??
                    "#fffdf8",
                  appearance:
                    notebook.defaultPaperAppearance ??
                    (notebook.pages[0] ? getPageAppearance(notebook.pages[0]) : undefined),
                  title: "Nova página",
                });
          const changed = commitStructuralChange(targetDocumentId, (current) =>
            insertNotebookSection(
              current,
              section,
              page,
              options.index,
              timestamp(),
            ),
          );

          if (changed) {
            set({
              activeDocumentId: targetDocumentId,
              activePageId: page?.id ?? get().activePageId,
              activeDividerId: section.divider.id,
              selectedElementId: null,
            });
          }

          return changed ? section.id : null;
        },
        removeSection: (documentId, sectionId, strategy) => {
          const targetDocumentId = documentId ?? get().activeDocumentId;
          return commitStructuralChange(
            targetDocumentId,
            (document) =>
              removeNotebookSection(document, sectionId, strategy, timestamp()),
            { selectedElementId: null },
          );
        },
        renameSection: (documentId, sectionId, title) =>
          commitStructuralChange(documentId, (document) =>
            renameNotebookSection(document, sectionId, title, timestamp()),
          ),
        reorderSections: (documentId, fromIndex, toIndex) =>
          commitStructuralChange(documentId, (document) =>
            reorderNotebookSections(document, fromIndex, toIndex, timestamp()),
          ),
        updateNotebookDivider: (documentId, sectionId, updates) =>
          commitStructuralChange(documentId, (document) =>
            updateNotebookSectionDivider(
              document,
              sectionId,
              updates,
              timestamp(),
            ),
          ),
        updateDividerColor: (documentId, sectionId, color) =>
          get().updateNotebookDivider(documentId, sectionId, { color }),
        updateDividerTabColor: (documentId, sectionId, color) =>
          get().updateNotebookDivider(documentId, sectionId, {
            tabColor: color,
          }),
        updateDividerTextColor: (documentId, sectionId, color) =>
          get().updateNotebookDivider(documentId, sectionId, {
            textColor: color,
          }),
        updateDividerTabPosition: (documentId, sectionId, position) =>
          get().updateNotebookDivider(documentId, sectionId, {
            tabPosition: position,
          }),
        addPageToSection: (documentId, sectionId, index) => {
          const targetDocumentId = documentId ?? get().activeDocumentId;
          const document = get().documents.find(
            (item) => item.id === targetDocumentId,
          );
          const notebook = document ? syncDocument(document) : undefined;
          const section = notebook?.sections?.find(
            (item) => item.id === sectionId,
          );
          if (!notebook || !section) {
            return null;
          }
          const activePage = getActivePage(notebook);
          const inheritedAppearance = notebook.defaultPaperAppearance
            ? normalizePaperAppearance(notebook.defaultPaperAppearance)
            : activePage
              ? getPageAppearance(activePage)
              : DEFAULT_PAPER_APPEARANCE;
          const page = createEmptyPage({
            documentId: notebook.id,
            sectionId: section.id,
            order: getSectionInsertionOrder(
              getPagesInSection(notebook, section.id),
              index,
            ),
            paperType: inheritedAppearance.paperType,
            paperColor: inheritedAppearance.paperColor,
            appearance: inheritedAppearance,
            title: "Nova página",
          });
          const changed = commitStructuralChange(targetDocumentId, (current) =>
            insertNotebookPage(current, page, timestamp()),
          );
          if (changed) {
            set({
              activeDocumentId: targetDocumentId,
              activePageId: page.id,
              selectedElementId: null,
            });
          }
          return changed ? page.id : null;
        },
        movePageToSection: (documentId, pageId, targetSectionId, index) =>
          commitStructuralChange(
            documentId,
            (document) =>
              moveNotebookPage(
                document,
                pageId,
                targetSectionId,
                index,
                timestamp(),
              ),
            { activePageId: pageId, selectedElementId: null },
          ),
        removePageFromSection: (documentId, pageId) =>
          commitStructuralChange(
            documentId,
            (document) => removeNotebookPage(document, pageId, timestamp()),
            { selectedElementId: null },
          ),
        reorderPagesWithinSection: (
          documentId,
          sectionId,
          fromIndex,
          toIndex,
        ) =>
          commitStructuralChange(documentId, (document) =>
            reorderNotebookPages(
              document,
              sectionId,
              fromIndex,
              toIndex,
              timestamp(),
            ),
          ),
        setActiveSurface: (surfaceId, documentId) =>
          navigateToSurface(documentId, surfaceId),
        goToNextSurface: (documentId) => {
          const document = getNotebookDocument(get(), documentId);
          if (!document) {
            return false;
          }
          const surfaces = buildNotebookSurfaces(document);
          const currentIndex = surfaces.findIndex(
            (surface) => surface.id === document.activeSurfaceId,
          );
          const next =
            surfaces[Math.min(surfaces.length - 1, currentIndex + 1)];
          return Boolean(
            next &&
            currentIndex >= 0 &&
            next.id !== document.activeSurfaceId &&
            navigateToSurface(document.id, next.id),
          );
        },
        goToPreviousSurface: (documentId) => {
          const document = getNotebookDocument(get(), documentId);
          if (!document) {
            return false;
          }
          const surfaces = buildNotebookSurfaces(document);
          const currentIndex = surfaces.findIndex(
            (surface) => surface.id === document.activeSurfaceId,
          );
          const previous = surfaces[Math.max(0, currentIndex - 1)];
          return Boolean(
            previous &&
            currentIndex > 0 &&
            navigateToSurface(document.id, previous.id),
          );
        },
        goToFirstSurface: (documentId) => {
          const document = getNotebookDocument(get(), documentId);
          const first = document
            ? buildNotebookSurfaces(document)[0]
            : undefined;
          return Boolean(
            document &&
            first &&
            first.id !== document.activeSurfaceId &&
            navigateToSurface(document.id, first.id),
          );
        },
        goToLastSurface: (documentId) => {
          const document = getNotebookDocument(get(), documentId);
          const surfaces = document ? buildNotebookSurfaces(document) : [];
          const last = surfaces.at(-1);
          return Boolean(
            document &&
            last &&
            last.id !== document.activeSurfaceId &&
            navigateToSurface(document.id, last.id),
          );
        },
        goToSection: (sectionId, documentId) => {
          const document = getNotebookDocument(get(), documentId);
          const section = document?.sections?.find(
            (item) => item.id === sectionId,
          );
          return Boolean(
            document &&
            section &&
            navigateToSurface(document.id, section.divider.id),
          );
        },
        goToPage: (pageId, documentId) => {
          const document = getNotebookDocument(get(), documentId);
          return Boolean(
            document &&
            document.pages.some((page) => page.id === pageId) &&
            navigateToSurface(document.id, pageId),
          );
        },
        toggleFavoriteActiveDocument: () => {
          const state = get();
          const document = state.documents.find(
            (item) => item.id === state.activeDocumentId,
          );
          if (document) {
            state.updateDocument(document.id, { favorite: !document.favorite });
          }
        },
        clearActivePageElements: () => {
          const state = get();
          const page = state.documents
            .flatMap((document) => document.pages)
            .find((item) => item.id === state.activePageId);
          state.updatePage(state.activePageId, {
            elements: page?.elements.filter((element) => element.locked) ?? [],
          });
          state.clearSelection();
        },
        applyDocumentsSnapshot: (documents) =>
          set((state) => {
            const sanitized = sanitizeDocuments(documents);
            const activeDocument =
              sanitized.find(
                (document) => document.id === state.activeDocumentId,
              ) ?? sanitized[0];
            const activePageId =
              activeDocument.pages.find(
                (page) => page.id === state.activePageId,
              )?.id ?? activeDocument.activePageId;

            return {
              documents: sanitized,
              activeDocumentId: activeDocument.id,
              activePageId,
              activeDividerId: activeDocument.dividers[0]?.id ?? null,
              selectedElementId: null,
            };
          }),
        restoreDemoDocuments: (identityScope) =>
          set({
            ...(identityScope
              ? createScopedDemoState(identityScope)
              : fallbackState),
          }),
      };
    },
    {
      name: "moctes-documents-v1",
      version: 10,
      storage: createJSONStorage(getDocumentStoreStorage),
      migrate: (persisted) => sanitizePersistedState(persisted),
      partialize: (state) => ({
        documents: state.documents,
        activeDocumentId: state.activeDocumentId,
        activePageId: state.activePageId,
        activeDividerId: state.activeDividerId,
        selectedElementId: null,
      }),
    },
  ),
);

function updateDocuments(
  state: DocumentStoreState,
  update: (document: MoctesDocument) => MoctesDocument,
  extras: Partial<DocumentStoreState> = {},
): Partial<DocumentStoreState> {
  return {
    documents: state.documents.map((document) =>
      syncDocument(update(document)),
    ),
    ...extras,
  };
}

function findElement(
  documents: MoctesDocument[],
  elementId: string,
): PageElement | undefined {
  for (const document of documents) {
    for (const page of document.pages) {
      const element = page.elements.find((item) => item.id === elementId);
      if (element) {
        return element;
      }
    }
  }
  return undefined;
}

function normalizeZIndexes(elements: PageElement[]): PageElement[] {
  return [...elements]
    .sort((first, second) => first.zIndex - second.zIndex)
    .map((element, index) => ({ ...element, zIndex: index + 1 }));
}

function syncDocument(document: MoctesDocument): MoctesDocument {
  return document.type === "notebook"
    ? reconcileNotebookDocument(document)
    : document;
}

function getNotebookDocument(
  state: DocumentStoreState,
  documentId?: string,
): MoctesDocument | undefined {
  const targetDocumentId = documentId ?? state.activeDocumentId;
  const document = state.documents.find((item) => item.id === targetDocumentId);
  return document?.type === "notebook" ? syncDocument(document) : undefined;
}

function sanitizePersistedState(value: unknown): PersistedDocumentState {
  if (!isDocumentStoreSnapshot(value)) {
    return fallbackState;
  }

  const documents = sanitizeDocuments(value.documents);
  const activeDocument =
    documents.find((document) => document.id === value.activeDocumentId) ??
    documents[0];
  const activePageId =
    activeDocument.pages.find((page) => page.id === value.activePageId)?.id ??
    activeDocument.activePageId;

  return {
    documents,
    activeDocumentId: activeDocument.id,
    activePageId,
    activeDividerId:
      activeDocument.dividers.find(
        (divider) => divider.id === value.activeDividerId,
      )?.id ??
      activeDocument.dividers[0]?.id ??
      null,
    selectedElementId: null,
  };
}

function createScopedDemoState(identityScope: string): PersistedDocumentState {
  const suffix = identityScope.replace(/[^a-zA-Z0-9-]/g, "").slice(-48);
  const documents = fallbackState.documents.map((document) => {
    const id = `${document.id}-${suffix}`;
    return {
      ...document,
      id,
      pages: document.pages.map((page) => ({ ...page, documentId: id })),
      dividers: document.dividers.map((divider) => ({
        ...divider,
        documentId: id,
      })),
    };
  });
  const activeDocument = documents[0];
  return {
    documents,
    activeDocumentId: activeDocument.id,
    activePageId: activeDocument.activePageId,
    activeDividerId: activeDocument.dividers[0]?.id ?? null,
    selectedElementId: null,
  };
}

function sanitizeDocuments(documents: MoctesDocument[]): MoctesDocument[] {
  const sanitized = documents
    .filter(
      (document) => Array.isArray(document.pages) && document.pages.length > 0,
    )
    .map((document) => {
      const pages = normalizePageOrder(
        document.pages.map((page) => {
          const appearance = normalizePaperAppearance({
            paperType: page.paperType,
            paperColor: page.paperColor,
            patternColor: page.patternColor,
            patternOpacity: page.patternOpacity,
            patternSize: page.patternSize,
            paperTexture: page.paperTexture,
            textureIntensity: page.textureIntensity,
            margins: page.margins,
          });
          return {
            ...page,
            ...appearance,
            margins: { ...appearance.margins },
            elements: Array.isArray(page.elements)
              ? normalizeZIndexes(
                  page.elements.map((element) => ({
                    ...element,
                    style:
                      element.type === "image" || element.type === "sticker"
                        ? {
                            ...element.style,
                            image: {
                              ...element.style.image,
                              objectFit: "contain",
                            },
                          }
                        : element.style,
                    locked: Boolean(element.locked),
                    hidden: Boolean(element.hidden),
                    rotation: Number.isFinite(element.rotation)
                      ? element.rotation
                      : 0,
                    zIndex: Number.isFinite(element.zIndex) ? element.zIndex : 1,
                    content: sanitizeElementContent(element.content),
                    lockAspectRatio:
                      element.type === "tape"
                        ? false
                        : element.lockAspectRatio,
                    minWidth: Number.isFinite(element.minWidth)
                      ? element.minWidth
                      : element.minWidth,
                    minHeight: Number.isFinite(element.minHeight)
                      ? element.minHeight
                      : element.minHeight,
                  })),
                )
              : [],
          };
        }),
      );
      const activePageId =
        pages.find((page) => page.id === document.activePageId)?.id ??
        pages[0].id;

      return syncDocument({
        ...document,
        pages,
        defaultPaperAppearance: normalizePaperAppearance(
          document.defaultPaperAppearance,
          getPageAppearance(pages[0]),
        ),
        paperTemplates: Array.isArray(document.paperTemplates)
          ? document.paperTemplates.slice(0, 24).map(normalizePaperTemplate)
          : [],
        dividers: Array.isArray(document.dividers) ? document.dividers : [],
        activePageId,
      });
    });

  return sanitized.length > 0 ? sanitized : initialDocuments;
}

function sanitizeElementContent(
  content: PageElement["content"],
): PageElement["content"] {
  const normalizedAssetContent = normalizeAssetElementContent(content);
  if (normalizedAssetContent.kind === "tape") {
    return normalizeTapeContent(normalizedAssetContent);
  }
  if (content.kind === "checklist") {
    return normalizeChecklistContent(content);
  }
  if (normalizedAssetContent !== content) {
    return normalizedAssetContent;
  }
  if (content.kind === "comment") {
    const legacyText = "text" in content ? String(content.text) : "Comentário";
    const createdAt = content.createdAt || timestamp();
    return {
      ...content,
      color:
        "color" in content && typeof content.color === "string"
          ? content.color
          : "#8da3ed",
      resolved: Boolean(content.resolved),
      createdAt,
      messages:
        "messages" in content && Array.isArray(content.messages)
          ? content.messages
          : [
              {
                id: `msg-${crypto.randomUUID()}`,
                authorLabel: "Pessoa usuária",
                text: legacyText,
                createdAt,
                attachments: [],
              },
            ],
    };
  }
  if (content.kind === "shape") {
    const shapeType = content.shape;
    return {
      ...content,
      appearance: normalizeShapeAppearance({
        ...content.appearance,
        shapeType,
      }),
    };
  }
  if (content.kind === "drawing") {
    return {
      ...content,
      paths: Array.isArray(content.paths) ? content.paths : [],
    };
  }
  if (content.kind === "post-it") {
    return normalizePostItContent(content);
  }
  return content;
}

function isDocumentStoreSnapshot(
  value: unknown,
): value is PersistedDocumentState {
  return (
    typeof value === "object" &&
    value !== null &&
    "documents" in value &&
    Array.isArray((value as { documents: unknown }).documents)
  );
}
