import { beforeEach, describe, expect, it } from "vitest";
import type { MoctesDocument } from "../types/document.types";
import type { PageElement } from "../types/element.types";
import { resetStores } from "../test/helpers/resetStores";
import { buildNotebookSurfaces } from "../utils/notebookSurfaces.utils";
import { validateNotebookDocument } from "../utils/notebookValidation.utils";
import { reconcileNotebookDocument } from "../utils/notebookMigration.utils";
import { useDocumentStore } from "./useDocumentStore";
import { useEditorStore } from "./useEditorStore";

function activeNotebook(): MoctesDocument {
  const state = useDocumentStore.getState();
  const document = state.documents.find((item) => item.id === state.activeDocumentId);
  if (!document || document.type !== "notebook") {
    throw new Error("Active notebook not found");
  }
  return document;
}

function assertNotebookInvariants(document: MoctesDocument) {
  const validation = validateNotebookDocument(document);
  expect(validation.errors).toEqual([]);

  const sectionPageIds = document.sections?.flatMap((section) =>
    section.pages.map((page) => page.id),
  ) ?? [];
  const documentPageIds = document.pages.map((page) => page.id);
  const dividerIds = document.sections?.map((section) => section.divider.id) ?? [];

  expect(new Set(sectionPageIds).size).toBe(sectionPageIds.length);
  expect([...sectionPageIds].sort()).toEqual([...documentPageIds].sort());
  expect(document.dividers.map((divider) => divider.id)).toEqual(dividerIds);
  expect(buildNotebookSurfaces(document).some((surface) => surface.id === document.activeSurfaceId)).toBe(true);
  expect(document.pages.some((page) => page.id === document.activePageId)).toBe(true);

  for (const section of document.sections ?? []) {
    for (const page of section.pages) {
      expect(page.dividerId).toBe(section.divider.id);
      expect(document.pages.find((item) => item.id === page.id)).toBe(page);
    }
  }
}

function addMarkerElement(pageId: string, marker = "marker"): PageElement {
  const element: PageElement = {
    id: `el-${marker}`,
    type: "text",
    x: 5,
    y: 5,
    width: 20,
    height: 8,
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    content: { kind: "text", text: marker },
    style: {},
  };
  useDocumentStore.getState().addElement(pageId, element);
  return element;
}

function undo() {
  const documentState = useDocumentStore.getState();
  const next = useEditorStore.getState().undo(documentState.documents);
  if (next) {
    documentState.applyDocumentsSnapshot(next);
  }
}

function redo() {
  const documentState = useDocumentStore.getState();
  const next = useEditorStore.getState().redo(documentState.documents);
  if (next) {
    documentState.applyDocumentsSnapshot(next);
  }
}

describe("useDocumentStore notebook v2 structural actions", () => {
  beforeEach(() => resetStores());

  it("addSection cria secao, divisoria e primeira pagina com uma entrada de historico", () => {
    const before = activeNotebook();
    const sectionId = useDocumentStore.getState().addSection(before.id, { title: "Banco" });
    const document = activeNotebook();
    const section = document.sections?.find((item) => item.id === sectionId);

    expect(section).toBeDefined();
    expect(section?.title).toBe("Banco");
    expect(section?.pages).toHaveLength(1);
    expect(document.activeSurfaceId).toBe(section?.divider.id);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
    assertNotebookInvariants(document);
  });

  it("addSection com createInitialPage false cria uma secao valida sem pagina", () => {
    const documentId = activeNotebook().id;
    const sectionId = useDocumentStore.getState().addSection(documentId, {
      title: "Arquivo",
      createInitialPage: false,
    });
    const document = activeNotebook();
    const section = document.sections?.find((item) => item.id === sectionId);

    expect(section?.pages).toHaveLength(0);
    expect(document.activeSurfaceId).toBe(section?.divider.id);
    assertNotebookInvariants(document);
  });

  it("renameSection preserva IDs e atualiza divisoria de compatibilidade", () => {
    const document = activeNotebook();
    const section = document.sections?.[0];
    expect(section).toBeDefined();

    const changed = useDocumentStore.getState().renameSection(document.id, section!.id, "Front");
    const updated = activeNotebook();

    expect(changed).toBe(true);
    expect(updated.sections?.[0].id).toBe(section!.id);
    expect(updated.sections?.[0].divider.id).toBe(section!.divider.id);
    expect(updated.dividers[0].name).toBe("Front");
    assertNotebookInvariants(updated);
  });

  it("reorderSections preserva paginas", () => {
    const store = useDocumentStore.getState();
    const documentId = activeNotebook().id;
    const secondSectionId = store.addSection(documentId, { title: "Segundo" });
    const before = activeNotebook();
    const secondPageIds = before.sections?.find((section) => section.id === secondSectionId)?.pages.map((page) => page.id);

    expect(useDocumentStore.getState().reorderSections(documentId, 1, 0)).toBe(true);
    const after = activeNotebook();

    expect(after.sections?.[0].id).toBe(secondSectionId);
    expect(after.sections?.[0].pages.map((page) => page.id)).toEqual(secondPageIds);
    assertNotebookInvariants(after);
  });

  it("updateNotebookDivider altera somente os campos fornecidos", () => {
    const document = activeNotebook();
    const section = document.sections![0];
    const originalTabColor = section.divider.tabColor;

    expect(useDocumentStore.getState().updateNotebookDivider(document.id, section.id, { color: "#123456" })).toBe(true);
    const updated = activeNotebook().sections![0];

    expect(updated.divider.color).toBe("#123456");
    expect(updated.divider.tabColor).toBe(originalTabColor);
    assertNotebookInvariants(activeNotebook());
  });

  it("removeSection com delete-pages nao deixa paginas orfas", () => {
    const store = useDocumentStore.getState();
    const documentId = activeNotebook().id;
    const sectionId = store.addSection(documentId, { title: "Remover" });

    expect(store.removeSection(documentId, sectionId!, { mode: "delete-pages" })).toBe(true);
    const document = activeNotebook();

    expect(document.sections?.some((section) => section.id === sectionId)).toBe(false);
    assertNotebookInvariants(document);
  });

  it("removeSection com move-pages preserva paginas e elementos", () => {
    const store = useDocumentStore.getState();
    const documentId = activeNotebook().id;
    const targetSectionId = activeNotebook().sections![0].id;
    const movingSectionId = store.addSection(documentId, { title: "Mover" });
    const movingPageId = activeNotebook().sections?.find((section) => section.id === movingSectionId)?.pages[0].id;
    const element = addMarkerElement(movingPageId!, "moved");

    expect(store.removeSection(documentId, movingSectionId!, { mode: "move-pages", targetSectionId })).toBe(true);
    const document = activeNotebook();
    const movedPage = document.pages.find((page) => page.id === movingPageId);

    expect(movedPage?.elements.some((item) => item.id === element.id)).toBe(true);
    expect(document.sections?.find((section) => section.id === targetSectionId)?.pages.some((page) => page.id === movingPageId)).toBe(true);
    assertNotebookInvariants(document);
  });

  it("nao permite mover paginas para secao inexistente", () => {
    const document = activeNotebook();
    const pageId = document.pages[0].id;

    expect(useDocumentStore.getState().movePageToSection(document.id, pageId, "missing")).toBe(false);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
    assertNotebookInvariants(activeNotebook());
  });

  it("addPageToSection atualiza pages, sections e dividerId", () => {
    const document = activeNotebook();
    const section = document.sections![0];
    const pageId = useDocumentStore.getState().addPageToSection(document.id, section.id);
    const updated = activeNotebook();
    const page = updated.pages.find((item) => item.id === pageId);

    expect(page?.dividerId).toBe(section.divider.id);
    expect(updated.sections?.[0].pages.some((item) => item.id === pageId)).toBe(true);
    expect(updated.activePageId).toBe(pageId);
    expect(updated.activeSurfaceId).toBe(pageId);
    assertNotebookInvariants(updated);
  });

  it("movePageToSection preserva elementos e nao duplica pagina", () => {
    const store = useDocumentStore.getState();
    const documentId = activeNotebook().id;
    const targetSectionId = store.addSection(documentId, { title: "Destino", createInitialPage: false });
    const pageId = activeNotebook().pages[0].id;
    const element = addMarkerElement(pageId, "preserved");

    expect(store.movePageToSection(documentId, pageId, targetSectionId!)).toBe(true);
    const document = activeNotebook();
    const sectionPageIds = document.sections?.flatMap((section) => section.pages.map((page) => page.id)) ?? [];

    expect(document.pages.find((page) => page.id === pageId)?.elements.some((item) => item.id === element.id)).toBe(true);
    expect(sectionPageIds.filter((id) => id === pageId)).toHaveLength(1);
    assertNotebookInvariants(document);
  });

  it("reorderPagesWithinSection preserva conteudo", () => {
    const document = activeNotebook();
    const section = document.sections![0];
    const newPageId = useDocumentStore.getState().addPageToSection(document.id, section.id);
    const element = addMarkerElement(newPageId!, "reordered");

    const lastIndex = activeNotebook().sections![0].pages.length - 1;

    expect(useDocumentStore.getState().reorderPagesWithinSection(document.id, section.id, lastIndex, 0)).toBe(true);
    const updatedSection = activeNotebook().sections![0];

    expect(updatedSection.pages[0].id).toBe(newPageId);
    expect(updatedSection.pages[0].elements.some((item) => item.id === element.id)).toBe(true);
    assertNotebookInvariants(activeNotebook());
  });

  it("removePageFromSection escolhe activeSurfaceId valida", () => {
    const document = activeNotebook();
    const pageId = document.pages[0].id;
    const newPageId = useDocumentStore.getState().addPageToSection(document.id, document.sections![0].id);

    useDocumentStore.getState().goToPage(pageId);
    expect(useDocumentStore.getState().removePageFromSection(document.id, pageId)).toBe(true);
    const updated = activeNotebook();

    expect(updated.pages.some((page) => page.id === pageId)).toBe(false);
    expect(buildNotebookSurfaces(updated).some((surface) => surface.id === updated.activeSurfaceId)).toBe(true);
    expect(updated.pages.some((page) => page.id === newPageId)).toBe(true);
    assertNotebookInvariants(updated);
  });

  it("navega por superficies sem criar historico", () => {
    const store = useDocumentStore.getState();
    const document = activeNotebook();
    const section = document.sections![0];

    expect(store.goToSection(section.id, document.id)).toBe(true);
    expect(activeNotebook().activeSurfaceId).toBe(section.divider.id);
    expect(store.goToNextSurface(document.id)).toBe(true);
    expect(activeNotebook().activeSurfaceId).toBe(section.pages[0].id);
    expect(store.goToPreviousSurface(document.id)).toBe(true);
    expect(activeNotebook().activeSurfaceId).toBe(section.divider.id);
    expect(store.goToPreviousSurface(document.id)).toBe(false);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
  });

  it("avanca da ultima pagina de uma secao para a proxima divisoria e para na ultima superficie", () => {
    const store = useDocumentStore.getState();
    const documentId = activeNotebook().id;
    const secondSectionId = store.addSection(documentId, { title: "Proxima" });
    const firstSection = activeNotebook().sections![0];

    expect(store.goToPage(firstSection.pages.at(-1)!.id, documentId)).toBe(true);
    expect(store.goToNextSurface(documentId)).toBe(true);
    expect(activeNotebook().activeSurfaceId).toBe(activeNotebook().sections?.find((section) => section.id === secondSectionId)?.divider.id);
    expect(store.goToLastSurface(documentId)).toBe(true);
    expect(store.goToNextSurface(documentId)).toBe(false);
  });

  it("setActiveSurface com pagina atualiza activePageId e com divisoria nao usa ID da divisoria", () => {
    const store = useDocumentStore.getState();
    const document = activeNotebook();
    const section = document.sections![0];
    const pageId = section.pages.at(-1)!.id;

    expect(store.setActiveSurface(section.divider.id, document.id)).toBe(true);
    expect(store.setActiveSurface(pageId, document.id)).toBe(true);
    expect(activeNotebook().activePageId).toBe(pageId);
    expect(store.setActiveSurface(section.divider.id, document.id)).toBe(true);
    expect(activeNotebook().activeSurfaceId).toBe(section.divider.id);
    expect(activeNotebook().activePageId).not.toBe(section.divider.id);
    assertNotebookInvariants(activeNotebook());
  });

  it("acao estrutural cria uma entrada de historico, undo e redo restauram estrutura", () => {
    const documentId = activeNotebook().id;
    const initialSectionCount = activeNotebook().sections!.length;
    const sectionId = useDocumentStore.getState().addSection(documentId, { title: "Historico" });

    expect(sectionId).toBeTruthy();
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
    undo();
    expect(activeNotebook().sections).toHaveLength(initialSectionCount);
    assertNotebookInvariants(activeNotebook());
    redo();
    expect(activeNotebook().sections).toHaveLength(initialSectionCount + 1);
    assertNotebookInvariants(activeNotebook());
  });

  it("hidratacao simulada nao duplica secoes e reconciliacao e idempotente", () => {
    const snapshot = activeNotebook();
    useDocumentStore.getState().applyDocumentsSnapshot([snapshot]);
    const once = activeNotebook();
    useDocumentStore.getState().applyDocumentsSnapshot([once]);
    const twice = activeNotebook();

    expect(twice.sections?.map((section) => section.id)).toEqual(once.sections?.map((section) => section.id));
    expect(reconcileNotebookDocument(twice)).toEqual(twice);
    assertNotebookInvariants(twice);
  });
});
