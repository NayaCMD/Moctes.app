import { beforeEach, describe, expect, it } from "vitest";
import { resetStores } from "../test/helpers/resetStores";
import { getSectionByPageId } from "../utils/notebookSurfaces.utils";
import { useDocumentStore } from "./useDocumentStore";
import { useEditorStore } from "./useEditorStore";

describe("useDocumentStore page templates", () => {
  beforeEach(() => resetStores());

  it("cria template em bloco como uma única operação editável", () => {
    const store = useDocumentStore.getState();
    const document = store.documents.find((item) => item.type === "notepad")!;
    const beforeCount = document.pages.length;
    const pageId = store.createPageFromTemplate({
      documentId: document.id,
      templateId: "daily-planner",
    });
    const updated = useDocumentStore.getState().documents.find((item) => item.id === document.id)!;
    const page = updated.pages.find((item) => item.id === pageId)!;

    expect(updated.pages).toHaveLength(beforeCount + 1);
    expect(page.title).toBe("Planejamento diário");
    expect(page.elements.some((element) => element.type === "checklist")).toBe(true);
    expect(page.paperType).toBe("grid");
    expect(useEditorStore.getState().undoStack).toHaveLength(1);

    const previous = useEditorStore.getState().undo(useDocumentStore.getState().documents);
    expect(previous).not.toBeNull();
    useDocumentStore.getState().applyDocumentsSnapshot(previous!);
    expect(
      useDocumentStore.getState().documents.find((item) => item.id === document.id)?.pages,
    ).toHaveLength(beforeCount);
  });

  it("insere template na seção escolhida do caderno", () => {
    const store = useDocumentStore.getState();
    const document = store.documents.find((item) => item.type === "notebook")!;
    const sectionId = document.sections![0].id;
    const pageId = store.createPageFromTemplate({
      documentId: document.id,
      sectionId,
      templateId: "studies",
    });
    const updated = useDocumentStore.getState().documents.find((item) => item.id === document.id)!;

    expect(pageId).toBeTruthy();
    expect(getSectionByPageId(updated, pageId!)?.id).toBe(sectionId);
    expect(updated.activeSurfaceId).toBe(pageId);
    expect(updated.pages.find((page) => page.id === pageId)?.title).toBe("Estudos");
  });

  it("página em branco herda a aparência padrão do documento", () => {
    const store = useDocumentStore.getState();
    const document = store.documents.find((item) => item.type === "clipboard")!;
    const defaultPaperAppearance = {
      paperType: "lined" as const,
      paperColor: "#fef4dd",
      patternColor: "#657f9d",
      patternOpacity: 18,
      patternSize: 26,
      paperTexture: "fiber" as const,
      textureIntensity: 20,
      margins: { top: 8, right: 8, bottom: 8, left: 12, visible: true },
    };
    store.updateDocument(document.id, { defaultPaperAppearance });
    const pageId = useDocumentStore.getState().createPageFromTemplate({
      documentId: document.id,
      templateId: "blank",
    });
    const page = useDocumentStore.getState().documents
      .find((item) => item.id === document.id)!
      .pages.find((item) => item.id === pageId)!;

    expect(page).toMatchObject(defaultPaperAppearance);
    expect(page.elements).toEqual([]);
  });
});
