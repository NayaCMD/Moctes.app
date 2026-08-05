import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { resetStores } from "../../test/helpers/resetStores";
import { TextElement } from "./TextElement";

function textElement() {
  const element = useDocumentStore
    .getState()
    .documents[0].pages[0].elements.find(
      (item) => item.type === "text" && item.content.kind === "text" && item.content.text.includes("Hoje"),
    );
  if (!element) {
    throw new Error("Text element not found");
  }
  return element;
}

describe("TextElement", () => {
  beforeEach(() => resetStores());

  it("renderiza texto", () => {
    render(<TextElement element={textElement()} />);

    expect(screen.getByText(/Hoje o dia/)).toBeInTheDocument();
  });

  it("salva conteúdo ao sair da edição", async () => {
    const element = textElement();
    useEditorStore.getState().setEditingTextElementId(element.id);
    render(<TextElement element={element} />);

    const editor = screen.getByLabelText("Editar texto");
    await userEvent.clear(editor);
    await userEvent.type(editor, "Novo texto");
    await userEvent.tab();

    const updated = useDocumentStore
      .getState()
      .documents.flatMap((document) => document.pages)
      .flatMap((page) => page.elements)
      .find((item) => item.id === element.id);
    expect(updated?.content).toEqual({ kind: "text", text: "Novo texto" });
  });

  it("Escape encerra edição sem remover elemento", async () => {
    const element = textElement();
    useEditorStore.getState().setEditingTextElementId(element.id);
    render(<TextElement element={element} />);

    await userEvent.keyboard("{Escape}");

    expect(useEditorStore.getState().editingTextElementId).toBeNull();
    expect(useDocumentStore.getState().documents[0].pages[0].elements.some((item) => item.id === element.id)).toBe(true);
  });
});
