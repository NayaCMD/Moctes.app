import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useDocumentStore } from "../stores/useDocumentStore";
import { useEditorStore } from "../stores/useEditorStore";
import { resetStores } from "../test/helpers/resetStores";
import { useEditorKeyboardShortcuts } from "./useEditorKeyboardShortcuts";

function KeyboardHarness() {
  useEditorKeyboardShortcuts();
  return null;
}

function getNotebook() {
  const document = useDocumentStore.getState().documents[0];
  const section = document.sections?.[0];

  if (!section) {
    throw new Error("Notebook section not found");
  }

  return { document, section };
}

describe("useEditorKeyboardShortcuts notebook editing guard", () => {
  beforeEach(() => resetStores());

  function openNotebook() {
    useEditorStore.setState({
      notebookBook: { documentId: getNotebook().document.id, phase: "open" },
    });
  }

  it("nao cola nem remove elementos da pagina anterior quando a divisoria esta aberta", async () => {
    const user = userEvent.setup();
    const { document, section } = getNotebook();
    const page = document.pages[0];
    const element = page.elements[0];
    const before = page.elements.length;
    openNotebook();
    useEditorStore.getState().setClipboardElement(element);
    useDocumentStore.getState().selectElement(element.id);
    useDocumentStore.getState().goToSection(section.id, document.id);

    render(<KeyboardHarness />);
    await user.keyboard("{Control>}v{/Control}");
    await user.keyboard("{Delete}");

    const updatedPage = useDocumentStore.getState().documents[0].pages[0];
    expect(updatedPage.elements).toHaveLength(before);
    expect(updatedPage.elements.some((item) => item.id === element.id)).toBe(true);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
    expect(useDocumentStore.getState().documents[0].activePageId).not.toBe(section.divider.id);
  });

  it("continua colando na folha quando a superficie ativa e pagina", async () => {
    const user = userEvent.setup();
    const { document } = getNotebook();
    const page = document.pages[0];
    const element = page.elements[0];
    openNotebook();
    useEditorStore.getState().setClipboardElement(element);
    useDocumentStore.getState().goToPage(page.id, document.id);

    render(<KeyboardHarness />);
    await user.keyboard("{Control>}v{/Control}");

    expect(useDocumentStore.getState().documents[0].pages[0].elements).toHaveLength(
      page.elements.length + 1,
    );
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
  });

  it("nao cola nem remove elementos enquanto o caderno esta em transicao", async () => {
    const user = userEvent.setup();
    const { document } = getNotebook();
    const page = document.pages[0];
    const element = page.elements[0];
    const before = page.elements.length;
    openNotebook();
    useEditorStore.getState().setClipboardElement(element);
    useDocumentStore.getState().selectElement(element.id);
    useDocumentStore.getState().goToPage(page.id, document.id);
    useEditorStore.getState().beginNotebookTransition({
      documentId: document.id,
      fromSurfaceId: page.id,
      toSurfaceId: document.pages[1].id,
      direction: "forward",
      phase: "running",
    });

    render(<KeyboardHarness />);
    await user.keyboard("{Control>}v{/Control}");
    await user.keyboard("{Delete}");

    const updatedPage = useDocumentStore.getState().documents[0].pages[0];
    expect(updatedPage.elements).toHaveLength(before);
    expect(updatedPage.elements.some((item) => item.id === element.id)).toBe(true);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
  });
});
