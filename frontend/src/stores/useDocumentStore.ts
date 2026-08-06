import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { initialDocuments } from "../data/initialDocuments";
import type { Divider, DocumentType, MoctesDocument } from "../types/document.types";
import type { PageElement } from "../types/element.types";
import type {
  AddNotebookSectionOptions,
  NotebookDividerUpdate,
  RemoveSectionStrategy,
} from "../types/notebook.types";
import type { Page } from "../types/page.types";
import { DEFAULT_SAFE_AREA } from "../utils/coordinates.utils";
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
  getSectionByPageId,
  getSurfaceById,
} from "../utils/notebookSurfaces.utils";
import { normalizePostItContent } from "../utils/postIt.utils";
import { normalizeShapeAppearance } from "../utils/shape.utils";
import { useEditorStore } from "./useEditorStore";

interface DocumentStoreState {
  documents: MoctesDocument[];
  activeDocumentId: string;
  activePageId: string;
  activeDividerId: string | null;
  selectedElementId: string | null;
  setActiveDocument: (documentId: string) => void;
  setActivePage: (pageId: string) => void;
  createDocument: (type: DocumentType) => string;
  updateDocument: (documentId: string, updates: Partial<MoctesDocument>) => void;
  deleteDocument: (documentId: string) => void;
  createPage: (documentId?: string) => string | null;
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
  addSection: (documentId?: string, options?: AddNotebookSectionOptions) => string | null;
  removeSection: (
    documentId: string | undefined,
    sectionId: string,
    strategy: RemoveSectionStrategy,
  ) => boolean;
  renameSection: (documentId: string | undefined, sectionId: string, title: string) => boolean;
  reorderSections: (documentId: string | undefined, fromIndex: number, toIndex: number) => boolean;
  updateNotebookDivider: (
    documentId: string | undefined,
    sectionId: string,
    updates: NotebookDividerUpdate,
  ) => boolean;
  updateDividerColor: (documentId: string | undefined, sectionId: string, color: string) => boolean;
  updateDividerTabColor: (documentId: string | undefined, sectionId: string, color: string) => boolean;
  updateDividerTextColor: (documentId: string | undefined, sectionId: string, color: string) => boolean;
  updateDividerTabPosition: (documentId: string | undefined, sectionId: string, position: number) => boolean;
  addPageToSection: (documentId: string | undefined, sectionId: string, index?: number) => string | null;
  movePageToSection: (
    documentId: string | undefined,
    pageId: string,
    targetSectionId: string,
    index?: number,
  ) => boolean;
  removePageFromSection: (documentId: string | undefined, pageId: string) => boolean;
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
  restoreDemoDocuments: () => void;
}

type PersistedDocumentState = Pick<
  DocumentStoreState,
  "documents" | "activeDocumentId" | "activePageId" | "activeDividerId" | "selectedElementId"
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
      const commitStructuralChange = (
        documentId: string | undefined,
        update: (document: MoctesDocument) => MoctesDocument | null,
        extras: Partial<DocumentStoreState> = {},
      ): boolean => {
        const targetDocumentId = documentId ?? get().activeDocumentId;
        const before = get().documents;
        let changed = false;

        set((state) => {
          const documents = state.documents.map((document) => {
            if (document.id !== targetDocumentId) {
              return document;
            }
            const updated = update(document);
            if (!updated || updated === document) {
              return document;
            }
            changed = true;
            return syncDocument(updated);
          });

          return changed ? { documents, ...extras } : state;
        });

        if (changed) {
          useEditorStore.getState().recordHistory(before);
        }

        return changed;
      };

      const navigateToSurface = (documentId: string | undefined, surfaceId: string): boolean => {
        const targetDocumentId = documentId ?? get().activeDocumentId;
        let didNavigate = false;

        set((state) => {
          const document = state.documents.find((item) => item.id === targetDocumentId);
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
              : reconciled.pages.some((page) => page.id === reconciled.activePageId)
                ? reconciled.activePageId
                : reconciled.pages[0]?.id ?? state.activePageId;

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
            documents: state.documents.map((item) => item.id === targetDocumentId ? nextDocument : item),
            activeDocumentId: targetDocumentId,
            activePageId,
            activeDividerId: surface.kind === "divider" ? surface.id : state.activeDividerId,
            selectedElementId: null,
          };
        });

        return didNavigate;
      };

      return ({
      ...fallbackState,
      setActiveDocument: (documentId) =>
        set((state) => {
          const document = state.documents.find((item) => item.id === documentId);
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

              return { ...document, activePageId: page.id, activeSurfaceId: page.id, updatedAt: timestamp() };
            },
            { activePageId: pageId, selectedElementId: null },
          ),
        ),
      createDocument: (type) => {
        const document = createEmptyDocument(type);
        set((state) => ({
          documents: [...state.documents, document],
          activeDocumentId: document.id,
          activePageId: document.activePageId,
          activeDividerId: null,
          selectedElementId: null,
        }));
        return document.id;
      },
      updateDocument: (documentId, updates) =>
        set((state) => ({
          documents: state.documents.map((document) =>
            document.id === documentId
              ? syncDocument({ ...document, ...updates, id: document.id, updatedAt: timestamp() })
              : document,
          ),
        })),
      deleteDocument: (documentId) =>
        set((state) => {
          if (state.documents.length <= 1) {
            return state;
          }

          const documents = state.documents.filter((document) => document.id !== documentId);
          const activeDocument =
            state.activeDocumentId === documentId
              ? documents[0]
              : documents.find((document) => document.id === state.activeDocumentId) ?? documents[0];

          return {
            documents,
            activeDocumentId: activeDocument.id,
            activePageId: activeDocument.activePageId,
            activeDividerId: activeDocument.dividers[0]?.id ?? null,
            selectedElementId: null,
          };
        }),
      createPage: (documentId) => {
        const targetDocumentId = documentId ?? get().activeDocumentId;
        let createdPageId: string | null = null;

        set((state) => ({
          documents: state.documents.map((document) => {
            if (document.id !== targetDocumentId) {
              return document;
            }

            const activePage = getActivePage(document);
            const inheritedPaperType = activePage?.paperType ?? "dotted";

            const page = createEmptyPage({
              documentId: document.id,
              dividerId: activePage?.dividerId,
              order: document.pages.length + 1,
              paperType: inheritedPaperType,
              paperColor: activePage?.paperColor ?? "#fffdf8",
              patternColor: activePage?.patternColor ?? "#72a0b9",
              patternOpacity: activePage?.patternOpacity ?? 14,
              patternSize:
                activePage?.patternSize ?? getDefaultPatternSize(inheritedPaperType),
              title: "Nova página",
            });

            createdPageId = page.id;

            return syncDocument({
              ...document,
              pages: normalizePageOrder([...document.pages, page]),
              activePageId: page.id,
              updatedAt: timestamp(),
            });
          }),
          activePageId: createdPageId ?? state.activePageId,
          selectedElementId: null,
        }));

        return createdPageId;
      },
      updatePage: (pageId, updates) =>
        set((state) =>
          updatePageInState(state, pageId, (page) => ({
            ...page,
            ...updates,
            id: page.id,
            documentId: page.documentId,
            elements: updates.elements ?? page.elements,
            updatedAt: timestamp(),
          })),
        ),
      deletePage: (pageId) =>
        set((state) => {
          let nextActivePageId = state.activePageId;
          const documents = state.documents.map((document) => {
            const page = document.pages.find((item) => item.id === pageId);
            if (!page || document.pages.length <= 1) {
              return document;
            }

            const pages = normalizePageOrder(document.pages.filter((item) => item.id !== pageId));
            if (document.activePageId === pageId) {
              nextActivePageId = pages[0].id;
            }

            return syncDocument({
              ...document,
              pages,
              activePageId: document.activePageId === pageId ? pages[0].id : document.activePageId,
              updatedAt: timestamp(),
            });
          });

          return { documents, activePageId: nextActivePageId, selectedElementId: null };
        }),
      duplicatePage: (pageId) => {
        let duplicatedPageId: string | null = null;
        set((state) => ({
          documents: state.documents.map((document) => {
            const page = document.pages.find((item) => item.id === pageId);
            if (!page) {
              return document;
            }

            const duplicatedPage = clonePage(page, {
              order: page.order + 0.5,
              title: page.title ? `${page.title} cópia` : "Página cópia",
            });
            duplicatedPageId = duplicatedPage.id;

            return syncDocument({
              ...document,
              pages: normalizePageOrder([...document.pages, duplicatedPage]),
              activePageId: duplicatedPage.id,
              updatedAt: timestamp(),
            });
          }),
          activePageId: duplicatedPageId ?? state.activePageId,
          selectedElementId: null,
        }));
        return duplicatedPageId;
      },
      createDivider: (documentId, name) => {
        const targetDocumentId = documentId ?? get().activeDocumentId;
        let dividerId: string | null = null;
        set((state) => ({
          documents: state.documents.map((document) => {
            if (document.id !== targetDocumentId) {
              return document;
            }

            const divider = createDividerModel({
              documentId: document.id,
              name,
              order: document.dividers.length + 1,
            });
            dividerId = divider.id;

            return syncDocument({
              ...document,
              dividers: [...document.dividers, divider],
              updatedAt: timestamp(),
            });
          }),
          activeDividerId: dividerId ?? state.activeDividerId,
        }));
        return dividerId;
      },
      updateDivider: (dividerId, updates) =>
        set((state) => ({
          documents: state.documents.map((document) =>
            syncDocument({
              ...document,
              dividers: document.dividers.map((divider) =>
                divider.id === dividerId
                  ? { ...divider, ...updates, id: divider.id, documentId: divider.documentId }
                  : divider,
              ),
            }),
          ),
        })),
      deleteDivider: (dividerId) =>
        set((state) => ({
          documents: state.documents.map((document) =>
            syncDocument({
              ...document,
              dividers: document.dividers.filter((divider) => divider.id !== dividerId),
              pages: document.pages.map((page) =>
                page.dividerId === dividerId ? { ...page, dividerId: undefined } : page,
              ),
            }),
          ),
          activeDividerId: state.activeDividerId === dividerId ? null : state.activeDividerId,
        })),
      addElement: (pageId, element) =>
        set((state) =>
          updatePageInState(
            state,
            pageId,
            (page) => ({
              ...page,
              elements: normalizeZIndexes([...page.elements, element]),
              updatedAt: timestamp(),
            }),
            { selectedElementId: element.id },
          ),
        ),
      moveElementToPage: ({ elementId, sourcePageId, targetPageId, x, y }) =>
        set((state) => {
          if (sourcePageId === targetPageId) {
            return updateElementInState(
              state,
              elementId,
              (element) => ({ ...element, x, y }),
              { activePageId: targetPageId, selectedElementId: elementId },
            );
          }

          let movingElement: PageElement | null = null;
          const documents = state.documents.map((document) => {
            const hasSource = document.pages.some((page) => page.id === sourcePageId);
            const hasTarget = document.pages.some((page) => page.id === targetPageId);
            if (!hasSource && !hasTarget) {
              return document;
            }

            const pagesWithoutElement = document.pages.map((page) => {
              if (page.id !== sourcePageId) {
                return page;
              }
              const element = page.elements.find((item) => item.id === elementId);
              if (!element || element.locked) {
                return page;
              }
              movingElement = { ...element, x, y };
              return {
                ...page,
                elements: normalizeZIndexes(page.elements.filter((item) => item.id !== elementId)),
                updatedAt: timestamp(),
              };
            });

            if (!movingElement || !hasTarget) {
              return document;
            }

            return syncDocument({
              ...document,
              pages: pagesWithoutElement.map((page) =>
                page.id === targetPageId
                  ? {
                    ...page,
                    elements: normalizeZIndexes([...page.elements, movingElement as PageElement]),
                    updatedAt: timestamp(),
                  }
                  : page,
              ),
              activePageId: targetPageId,
              updatedAt: timestamp(),
            });
          });

          if (!movingElement) {
            return state;
          }

          return {
            documents,
            activePageId: targetPageId,
            selectedElementId: elementId,
          };
        }),
      updateElement: (elementId, updates) =>
        set((state) =>
          updateElementInState(state, elementId, (element) => ({
            ...element,
            ...updates,
            id: element.id,
            content: updates.content ?? element.content,
            style: updates.style ?? element.style,
          })),
        ),
      updateElementStyle: (elementId, updates) =>
        set((state) =>
          updateElementInState(state, elementId, (element) => {
            if (element.locked) {
              return element;
            }
            return {
              ...element,
              style: {
                text: updates.text ?? element.style.text,
                box: updates.box ?? element.style.box,
                image: updates.image ?? element.style.image,
              },
            };
          }),
        ),
      deleteElement: (elementId) =>
        set((state) => {
          const element = findElement(state.documents, elementId);
          if (element?.locked) {
            return state;
          }

          return {
            documents: state.documents.map((document) =>
              syncDocument({
                ...document,
                pages: document.pages.map((page) => ({
                  ...page,
                  elements: normalizeZIndexes(page.elements.filter((item) => item.id !== elementId)),
                })),
              }),
            ),
            selectedElementId: state.selectedElementId === elementId ? null : state.selectedElementId,
          };
        }),
      duplicateElement: (elementId) => {
        let duplicatedElementId: string | null = null;
        set((state) => {
          const nextState = updateElementPageInState(state, elementId, (page, element) => {
            const duplicatedElement = placeElementForInsertion({
              element: cloneElement(element),
              existingElements: page.elements,
              safeArea: DEFAULT_SAFE_AREA,
            });
            duplicatedElementId = duplicatedElement.id;
            return {
              ...page,
              elements: normalizeZIndexes([...page.elements, duplicatedElement]),
              updatedAt: timestamp(),
            };
          });

          return { ...nextState, selectedElementId: duplicatedElementId };
        });
        return duplicatedElementId;
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
        set((state) =>
          updatePageInState(
            state,
            pageId,
            (page) => ({
              ...page,
              elements: normalizeZIndexes([...page.elements, pastedElement]),
              updatedAt: timestamp(),
            }),
            { selectedElementId: pastedElement.id },
          ),
        );
        return pastedElement.id;
      },
      toggleElementLock: (elementId) =>
        set((state) =>
          updateElementInState(state, elementId, (element) => ({ ...element, locked: !element.locked })),
        ),
      toggleElementVisibility: (elementId) =>
        set((state) =>
          updateElementInState(state, elementId, (element) => ({ ...element, hidden: !element.hidden })),
        ),
      bringElementToFront: (elementId) =>
        set((state) => updateLayerInState(state, elementId, "front")),
      sendElementToBack: (elementId) =>
        set((state) => updateLayerInState(state, elementId, "back")),
      moveElementForward: (elementId) =>
        set((state) => updateLayerInState(state, elementId, "forward")),
      moveElementBackward: (elementId) =>
        set((state) => updateLayerInState(state, elementId, "backward")),
      selectElement: (selectedElementId) => set({ selectedElementId }),
      clearSelection: () => set({ selectedElementId: null }),
      reorderPages: (documentId, pageIds) =>
        set((state) => ({
          documents: state.documents.map((document) => {
            if (document.id !== documentId) {
              return document;
            }

            const orderById = new Map(pageIds.map((pageId, index) => [pageId, index + 1]));
            return syncDocument({
              ...document,
              pages: normalizePageOrder(
                document.pages.map((page) => ({
                  ...page,
                  order: orderById.get(page.id) ?? page.order,
                })),
              ),
              updatedAt: timestamp(),
            });
          }),
        })),
      movePageToDivider: (pageId, dividerId) =>
        set((state) =>
          updatePageInState(
            state,
            pageId,
            (page) => ({ ...page, dividerId: dividerId ?? undefined, updatedAt: timestamp() }),
            { activeDividerId: dividerId },
          ),
        ),
      addSection: (documentId, options = {}) => {
        const targetDocumentId = documentId ?? get().activeDocumentId;
        let sectionId: string | null = null;
        let dividerId: string | null = null;
        let pageId: string | null = null;

        const changed = commitStructuralChange(targetDocumentId, (document) => {
          if (document.type !== "notebook") {
            return null;
          }

          const notebook = syncDocument(document);
          const section = createDefaultNotebookSection({
            title: options.title?.trim() || undefined,
            tabPosition: notebook.sections?.length ?? 0,
          });
          sectionId = section.id;
          dividerId = section.divider.id;
          section.divider.color = options.color ?? section.divider.color;
          section.divider.tabColor = options.color ?? section.divider.tabColor;

          const nextSections = [...(notebook.sections ?? [])];
          const insertIndex = clampIndex(options.index ?? nextSections.length, 0, nextSections.length);
          const shouldCreatePage = options.createInitialPage !== false;
          const page = shouldCreatePage
            ? createEmptyPage({
                documentId: notebook.id,
                dividerId: section.divider.id,
                order: notebook.pages.length + 1,
                paperType: notebook.pages[0]?.paperType ?? "dotted",
                paperColor: notebook.pages[0]?.paperColor ?? "#fffdf8",
                patternColor: notebook.pages[0]?.patternColor ?? "#72a0b9",
                patternOpacity: notebook.pages[0]?.patternOpacity ?? 14,
                patternSize: notebook.pages[0]?.patternSize ?? getDefaultPatternSize("dotted"),
                title: "Nova página",
              })
            : null;
          if (page) {
            pageId = page.id;
            section.pages = [page];
          }
          nextSections.splice(insertIndex, 0, section);

          return {
            ...notebook,
            sections: nextSections,
            pages: page ? [...notebook.pages, page] : notebook.pages,
            activePageId: page?.id ?? notebook.activePageId,
            activeSurfaceId: section.divider.id,
            updatedAt: timestamp(),
          };
        });

        if (changed) {
          set({
            activeDocumentId: targetDocumentId,
            activePageId: pageId ?? get().activePageId,
            activeDividerId: dividerId,
            selectedElementId: null,
          });
        }

        return changed ? sectionId : null;
      },
      removeSection: (documentId, sectionId, strategy) => {
        const targetDocumentId = documentId ?? get().activeDocumentId;
        return commitStructuralChange(targetDocumentId, (document) => {
          const notebook = syncDocument(document);
          const sections = notebook.sections ?? [];
          const sectionIndex = sections.findIndex((section) => section.id === sectionId);
          if (sectionIndex < 0 || sections.length <= 1) {
            return null;
          }

          const removingSection = sections[sectionIndex];
          const removingPageIds = new Set(removingSection.pages.map((page) => page.id));
          let nextSections = sections.filter((section) => section.id !== sectionId);
          let nextPages = notebook.pages.filter((page) => !removingPageIds.has(page.id));

          if (strategy.mode === "move-pages") {
            if (strategy.targetSectionId === sectionId) {
              return null;
            }
            const targetIndex = nextSections.findIndex((section) => section.id === strategy.targetSectionId);
            if (targetIndex < 0) {
              return null;
            }
            const targetSection = nextSections[targetIndex];
            const movedPages = removingSection.pages.map((page) => ({
              ...(notebook.pages.find((item) => item.id === page.id) ?? page),
              dividerId: targetSection.divider.id,
            }));
            nextSections = nextSections.map((section, index) =>
              index === targetIndex
                ? { ...section, pages: [...section.pages, ...movedPages] }
                : section,
            );
            nextPages = notebook.pages.map((page) =>
              removingPageIds.has(page.id) ? { ...page, dividerId: targetSection.divider.id } : page,
            );
          }

          const firstSurface = buildNotebookSurfaces({
            ...notebook,
            sections: nextSections,
            pages: nextPages,
          })[0];
          const firstPage = nextPages[0];

          return {
            ...notebook,
            sections: nextSections,
            pages: nextPages,
            dividers: notebook.dividers.filter((divider) => divider.id !== removingSection.divider.id),
            activeSurfaceId: firstSurface?.id ?? firstPage?.id ?? notebook.activeSurfaceId,
            activePageId: firstPage?.id ?? notebook.activePageId,
            updatedAt: timestamp(),
          };
        }, { selectedElementId: null });
      },
      renameSection: (documentId, sectionId, title) => {
        const nextTitle = title.trim();
        if (!nextTitle) {
          return false;
        }
        return commitStructuralChange(documentId, (document) => {
          const notebook = syncDocument(document);
          const section = notebook.sections?.find((item) => item.id === sectionId);
          if (!section || section.title === nextTitle) {
            return null;
          }
          return {
            ...notebook,
            sections: notebook.sections?.map((item) =>
              item.id === sectionId ? { ...item, title: nextTitle } : item,
            ),
            updatedAt: timestamp(),
          };
        });
      },
      reorderSections: (documentId, fromIndex, toIndex) =>
        commitStructuralChange(documentId, (document) => {
          const notebook = syncDocument(document);
          const sections = notebook.sections ?? [];
          if (
            fromIndex === toIndex ||
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= sections.length ||
            toIndex >= sections.length
          ) {
            return null;
          }
          return {
            ...notebook,
            sections: moveArrayItem(sections, fromIndex, toIndex),
            updatedAt: timestamp(),
          };
        }),
      updateNotebookDivider: (documentId, sectionId, updates) =>
        commitStructuralChange(documentId, (document) => {
          const notebook = syncDocument(document);
          const section = notebook.sections?.find((item) => item.id === sectionId);
          if (!section) {
            return null;
          }
          const nextTitle = updates.title?.trim();
          const nextSection = {
            ...section,
            title: nextTitle || section.title,
            divider: {
              ...section.divider,
              color: updates.color ?? section.divider.color,
              tabColor: updates.tabColor ?? section.divider.tabColor,
              textColor: updates.textColor ?? section.divider.textColor,
              tabPosition: updates.tabPosition ?? section.divider.tabPosition,
            },
          };
          if (sectionsEqual(section, nextSection)) {
            return null;
          }
          return {
            ...notebook,
            sections: notebook.sections?.map((item) => item.id === sectionId ? nextSection : item),
            updatedAt: timestamp(),
          };
        }),
      updateDividerColor: (documentId, sectionId, color) =>
        get().updateNotebookDivider(documentId, sectionId, { color }),
      updateDividerTabColor: (documentId, sectionId, color) =>
        get().updateNotebookDivider(documentId, sectionId, { tabColor: color }),
      updateDividerTextColor: (documentId, sectionId, color) =>
        get().updateNotebookDivider(documentId, sectionId, { textColor: color }),
      updateDividerTabPosition: (documentId, sectionId, position) =>
        get().updateNotebookDivider(documentId, sectionId, { tabPosition: position }),
      addPageToSection: (documentId, sectionId, index) => {
        const targetDocumentId = documentId ?? get().activeDocumentId;
        let pageId: string | null = null;
        const changed = commitStructuralChange(targetDocumentId, (document) => {
          const notebook = syncDocument(document);
          const section = notebook.sections?.find((item) => item.id === sectionId);
          if (!section) {
            return null;
          }
          const activePage = getActivePage(notebook);
          const page = createEmptyPage({
            documentId: notebook.id,
            dividerId: section.divider.id,
            order: notebook.pages.length + 1,
            paperType: activePage?.paperType ?? "dotted",
            paperColor: activePage?.paperColor ?? "#fffdf8",
            patternColor: activePage?.patternColor ?? "#72a0b9",
            patternOpacity: activePage?.patternOpacity ?? 14,
            patternSize: activePage?.patternSize ?? getDefaultPatternSize(activePage?.paperType ?? "dotted"),
            title: "Nova página",
          });
          pageId = page.id;
          const insertIndex = clampIndex(index ?? section.pages.length, 0, section.pages.length);
          return {
            ...notebook,
            pages: [...notebook.pages, page],
            sections: notebook.sections?.map((item) =>
              item.id === sectionId
                ? { ...item, pages: insertArrayItem(item.pages, page, insertIndex) }
                : item,
            ),
            activePageId: page.id,
            activeSurfaceId: page.id,
            updatedAt: timestamp(),
          };
        });
        if (changed && pageId) {
          set({
            activeDocumentId: targetDocumentId,
            activePageId: pageId,
            selectedElementId: null,
          });
        }
        return changed ? pageId : null;
      },
      movePageToSection: (documentId, pageId, targetSectionId, index) =>
        commitStructuralChange(documentId, (document) => {
          const notebook = syncDocument(document);
          const page = notebook.pages.find((item) => item.id === pageId);
          const sourceSection = getSectionByPageId(notebook, pageId);
          const targetSection = notebook.sections?.find((section) => section.id === targetSectionId);
          if (!page || !sourceSection || !targetSection) {
            return null;
          }
          const currentIndex = sourceSection.pages.findIndex((item) => item.id === pageId);
          const targetIndex = clampIndex(index ?? targetSection.pages.length, 0, targetSection.pages.length);
          if (sourceSection.id === targetSection.id && currentIndex === targetIndex) {
            return null;
          }
          const movedPage = { ...page, dividerId: targetSection.divider.id };
          return {
            ...notebook,
            pages: notebook.pages.map((item) => item.id === pageId ? movedPage : item),
            sections: notebook.sections?.map((section) => {
              const withoutPage = section.pages.filter((item) => item.id !== pageId);
              if (section.id !== targetSectionId) {
                return { ...section, pages: withoutPage };
              }
              return {
                ...section,
                pages: insertArrayItem(withoutPage, movedPage, targetIndex),
              };
            }),
            activePageId: pageId,
            activeSurfaceId: pageId,
            updatedAt: timestamp(),
          };
        }, { activePageId: pageId, selectedElementId: null }),
      removePageFromSection: (documentId, pageId) =>
        commitStructuralChange(documentId, (document) => {
          const notebook = syncDocument(document);
          if (!notebook.pages.some((page) => page.id === pageId)) {
            return null;
          }
          const remainingPages = notebook.pages.filter((page) => page.id !== pageId);
          if (remainingPages.length === 0) {
            return null;
          }
          const nextSections = notebook.sections?.map((section) => ({
            ...section,
            pages: section.pages.filter((page) => page.id !== pageId),
          })) ?? [];
          const nextDocument = syncDocument({
            ...notebook,
            pages: remainingPages,
            sections: nextSections,
            activePageId: remainingPages[0].id,
            activeSurfaceId: remainingPages[0].id,
            updatedAt: timestamp(),
          });
          return nextDocument;
        }, { selectedElementId: null }),
      reorderPagesWithinSection: (documentId, sectionId, fromIndex, toIndex) =>
        commitStructuralChange(documentId, (document) => {
          const notebook = syncDocument(document);
          const section = notebook.sections?.find((item) => item.id === sectionId);
          if (
            !section ||
            fromIndex === toIndex ||
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= section.pages.length ||
            toIndex >= section.pages.length
          ) {
            return null;
          }
          return {
            ...notebook,
            sections: notebook.sections?.map((item) =>
              item.id === sectionId
                ? { ...item, pages: moveArrayItem(item.pages, fromIndex, toIndex) }
                : item,
            ),
            updatedAt: timestamp(),
          };
        }),
      setActiveSurface: (surfaceId, documentId) => navigateToSurface(documentId, surfaceId),
      goToNextSurface: (documentId) => {
        const document = getNotebookDocument(get(), documentId);
        if (!document) {
          return false;
        }
        const surfaces = buildNotebookSurfaces(document);
        const currentIndex = surfaces.findIndex((surface) => surface.id === document.activeSurfaceId);
        const next = surfaces[Math.min(surfaces.length - 1, currentIndex + 1)];
        return Boolean(next && currentIndex >= 0 && next.id !== document.activeSurfaceId && navigateToSurface(document.id, next.id));
      },
      goToPreviousSurface: (documentId) => {
        const document = getNotebookDocument(get(), documentId);
        if (!document) {
          return false;
        }
        const surfaces = buildNotebookSurfaces(document);
        const currentIndex = surfaces.findIndex((surface) => surface.id === document.activeSurfaceId);
        const previous = surfaces[Math.max(0, currentIndex - 1)];
        return Boolean(previous && currentIndex > 0 && navigateToSurface(document.id, previous.id));
      },
      goToFirstSurface: (documentId) => {
        const document = getNotebookDocument(get(), documentId);
        const first = document ? buildNotebookSurfaces(document)[0] : undefined;
        return Boolean(document && first && first.id !== document.activeSurfaceId && navigateToSurface(document.id, first.id));
      },
      goToLastSurface: (documentId) => {
        const document = getNotebookDocument(get(), documentId);
        const surfaces = document ? buildNotebookSurfaces(document) : [];
        const last = surfaces.at(-1);
        return Boolean(document && last && last.id !== document.activeSurfaceId && navigateToSurface(document.id, last.id));
      },
      goToSection: (sectionId, documentId) => {
        const document = getNotebookDocument(get(), documentId);
        const section = document?.sections?.find((item) => item.id === sectionId);
        return Boolean(document && section && navigateToSurface(document.id, section.divider.id));
      },
      goToPage: (pageId, documentId) => {
        const document = getNotebookDocument(get(), documentId);
        return Boolean(document && document.pages.some((page) => page.id === pageId) && navigateToSurface(document.id, pageId));
      },
      toggleFavoriteActiveDocument: () => {
        const state = get();
        const document = state.documents.find((item) => item.id === state.activeDocumentId);
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
            sanitized.find((document) => document.id === state.activeDocumentId) ?? sanitized[0];
          const activePageId =
            activeDocument.pages.find((page) => page.id === state.activePageId)?.id ??
            activeDocument.activePageId;

          return {
            documents: sanitized,
            activeDocumentId: activeDocument.id,
            activePageId,
            activeDividerId: activeDocument.dividers[0]?.id ?? null,
            selectedElementId: null,
          };
        }),
      restoreDemoDocuments: () => set({ ...fallbackState }),
    });
    },
    {
      name: "moctes-documents-v1",
      version: 6,
      storage: createJSONStorage(() => localStorage),
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
  return { documents: state.documents.map((document) => syncDocument(update(document))), ...extras };
}

function updatePageInState(
  state: DocumentStoreState,
  pageId: string,
  update: (page: Page) => Page,
  extras: Partial<DocumentStoreState> = {},
): Partial<DocumentStoreState> {
  return {
    documents: state.documents.map((document) => ({
      ...syncDocument({
        ...document,
        pages: document.pages.map((page) => (page.id === pageId ? update(page) : page)),
        updatedAt: document.pages.some((page) => page.id === pageId) ? timestamp() : document.updatedAt,
      }),
    })),
    ...extras,
  };
}

function updateElementInState(
  state: DocumentStoreState,
  elementId: string,
  update: (element: PageElement) => PageElement,
  extras: Partial<DocumentStoreState> = {},
): Partial<DocumentStoreState> {
  return updateElementPageInState(state, elementId, (page, element) => ({
    ...page,
    elements: page.elements.map((item) => (item.id === elementId ? update(element) : item)),
    updatedAt: timestamp(),
  }), extras);
}

function updateElementPageInState(
  state: DocumentStoreState,
  elementId: string,
  update: (page: Page, element: PageElement) => Page,
  extras: Partial<DocumentStoreState> = {},
): Partial<DocumentStoreState> {
  return {
    documents: state.documents.map((document) => ({
      ...syncDocument({
        ...document,
        pages: document.pages.map((page) => {
          const element = page.elements.find((item) => item.id === elementId);
          return element ? update(page, element) : page;
        }),
        updatedAt: document.pages.some((page) => page.elements.some((element) => element.id === elementId))
          ? timestamp()
          : document.updatedAt,
      }),
    })),
    ...extras,
  };
}

function findElement(documents: MoctesDocument[], elementId: string): PageElement | undefined {
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

function updateLayerInState(
  state: DocumentStoreState,
  elementId: string,
  direction: "front" | "back" | "forward" | "backward",
): Partial<DocumentStoreState> {
  const element = findElement(state.documents, elementId);
  if (element?.locked) {
    return state;
  }

  return updateElementPageInState(state, elementId, (page) => {
    const ordered = normalizeZIndexes(page.elements);
    const index = ordered.findIndex((item) => item.id === elementId);
    if (index < 0) {
      return page;
    }

    const next = [...ordered];
    const [target] = next.splice(index, 1);
    const targetIndex =
      direction === "front"
        ? next.length
        : direction === "back"
          ? 0
          : direction === "forward"
            ? Math.min(next.length, index + 1)
            : Math.max(0, index - 1);
    next.splice(targetIndex, 0, target);

    return { ...page, elements: assignZIndexes(next), updatedAt: timestamp() };
  });
}

function assignZIndexes(elements: PageElement[]): PageElement[] {
  return elements.map((element, index) => ({ ...element, zIndex: index + 1 }));
}

function getDefaultPatternSize(paperType: Page["paperType"]): number {
  switch (paperType) {
    case "dotted":
      return 18;
    case "lined":
      return 25;
    case "grid":
    case "blank":
      return 22;
  }
}

function syncDocument(document: MoctesDocument): MoctesDocument {
  return document.type === "notebook" ? reconcileNotebookDocument(document) : document;
}

function clampIndex(index: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, index));
}

function insertArrayItem<T>(items: T[], item: T, index: number): T[] {
  const next = [...items];
  next.splice(clampIndex(index, 0, next.length), 0, item);
  return next;
}

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function sectionsEqual(
  first: NonNullable<MoctesDocument["sections"]>[number],
  second: NonNullable<MoctesDocument["sections"]>[number],
): boolean {
  return (
    first.title === second.title &&
    first.divider.color === second.divider.color &&
    first.divider.tabColor === second.divider.tabColor &&
    first.divider.textColor === second.divider.textColor &&
    first.divider.tabPosition === second.divider.tabPosition
  );
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
    documents.find((document) => document.id === value.activeDocumentId) ?? documents[0];
  const activePageId =
    activeDocument.pages.find((page) => page.id === value.activePageId)?.id ??
    activeDocument.activePageId;

  return {
    documents,
    activeDocumentId: activeDocument.id,
    activePageId,
    activeDividerId:
      activeDocument.dividers.find((divider) => divider.id === value.activeDividerId)?.id ??
      activeDocument.dividers[0]?.id ??
      null,
    selectedElementId: null,
  };
}

function sanitizeDocuments(documents: MoctesDocument[]): MoctesDocument[] {
  const sanitized = documents
    .filter((document) => Array.isArray(document.pages) && document.pages.length > 0)
    .map((document) => {
      const pages = normalizePageOrder(
        document.pages.map((page) => ({
          ...page,
          patternColor:
            typeof page.patternColor === "string" ? page.patternColor : "#72a0b9",
          patternOpacity:
            typeof page.patternOpacity === "number" && Number.isFinite(page.patternOpacity)
              ? page.patternOpacity
              : 14,
          patternSize:
            typeof page.patternSize === "number" && Number.isFinite(page.patternSize)
              ? page.patternSize
              : getDefaultPatternSize(page.paperType),
          elements: Array.isArray(page.elements)
            ? normalizeZIndexes(
              page.elements.map((element) => ({
                ...element,
                locked: Boolean(element.locked),
                hidden: Boolean(element.hidden),
                rotation: Number.isFinite(element.rotation) ? element.rotation : 0,
                zIndex: Number.isFinite(element.zIndex) ? element.zIndex : 1,
                content: sanitizeElementContent(element.content),
                minWidth: Number.isFinite(element.minWidth) ? element.minWidth : element.minWidth,
                minHeight: Number.isFinite(element.minHeight) ? element.minHeight : element.minHeight,
              })),
            )
            : [],
        })),
      );
      const activePageId = pages.find((page) => page.id === document.activePageId)?.id ?? pages[0].id;

      return syncDocument({
        ...document,
        pages,
        dividers: Array.isArray(document.dividers) ? document.dividers : [],
        activePageId,
      });
    });

  return sanitized.length > 0 ? sanitized : initialDocuments;
}

function sanitizeElementContent(content: PageElement["content"]): PageElement["content"] {
  if (content.kind === "comment") {
    const legacyText = "text" in content ? String(content.text) : "Comentário";
    const createdAt = content.createdAt || timestamp();
    return {
      ...content,
      color: "color" in content && typeof content.color === "string" ? content.color : "#8da3ed",
      resolved: Boolean(content.resolved),
      createdAt,
      messages:
        "messages" in content && Array.isArray(content.messages)
          ? content.messages
          : [
            {
              id: `msg-${crypto.randomUUID()}`,
              authorLabel: "Usuária",
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

function isDocumentStoreSnapshot(value: unknown): value is PersistedDocumentState {
  return (
    typeof value === "object" &&
    value !== null &&
    "documents" in value &&
    Array.isArray((value as { documents: unknown }).documents)
  );
}
