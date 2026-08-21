import { beforeEach, describe, expect, it } from "vitest";
import { resetStores } from "../test/helpers/resetStores";
import { BUILT_IN_PAPER_PRESETS } from "../utils/paperAppearance.utils";
import { useDocumentStore } from "./useDocumentStore";

describe("useDocumentStore paper appearance", () => {
  beforeEach(() => resetStores());

  it("faz novas páginas herdarem o preset definido para o documento", () => {
    const store = useDocumentStore.getState();
    const document = store.documents.find((item) => item.id === store.activeDocumentId)!;
    const appearance = BUILT_IN_PAPER_PRESETS[2].appearance;

    store.updateDocument(document.id, { defaultPaperAppearance: appearance });
    const pageId = useDocumentStore.getState().createPage(document.id);
    const page = useDocumentStore.getState().documents
      .find((item) => item.id === document.id)!
      .pages.find((item) => item.id === pageId)!;

    expect(page).toMatchObject({
      paperType: "grid",
      paperColor: appearance.paperColor,
      paperTexture: "grain",
      textureIntensity: appearance.textureIntensity,
      margins: appearance.margins,
    });
  });

  it("normaliza aparência legada e templates ao recuperar uma revisão", () => {
    const store = useDocumentStore.getState();
    const document = store.documents.find((item) => item.id === store.activeDocumentId)!;
    const legacy = {
      ...document,
      defaultPaperAppearance: undefined,
      paperTemplates: [{
        id: "custom",
        name: "  Meu papel  ",
        appearance: {
          ...BUILT_IN_PAPER_PRESETS[0].appearance,
          textureIntensity: 90,
        },
        createdAt: "2026-08-18T00:00:00.000Z",
      }],
      pages: document.pages.map((page) => ({
        ...page,
        paperTexture: undefined,
        margins: undefined,
      })),
    };

    store.applyDocumentsSnapshot([legacy]);
    const restored = useDocumentStore.getState().documents[0];

    expect(restored.defaultPaperAppearance).toBeDefined();
    expect(restored.pages[0].paperTexture).toBe("none");
    expect(restored.pages[0].margins?.visible).toBe(false);
    expect(restored.paperTemplates?.[0].name).toBe("Meu papel");
    expect(restored.paperTemplates?.[0].appearance.textureIntensity).toBe(50);
  });
});
