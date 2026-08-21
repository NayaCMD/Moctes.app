import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { resetStores } from "../../test/helpers/resetStores";
import type { ChecklistElementContent, PageElement } from "../../types/element.types";
import { createChecklistElement } from "../../utils/checklist.utils";
import { ChecklistElement } from "./ChecklistElement";

describe("ChecklistElement", () => {
  beforeEach(() => resetStores());

  it("conclui e desfaz um item com riscado automático", async () => {
    const element = insertChecklist();
    const { rerender } = render(<ChecklistElement element={element} />);

    await userEvent.click(screen.getByRole("button", { name: "Concluir Primeiro" }));
    const updated = findChecklist(element.id);
    expect(updated.content.items[0].completed).toBe(true);

    rerender(<ChecklistElement element={updated} />);
    expect(screen.getByText("Primeiro").closest(".checklist-item")).toHaveAttribute(
      "data-completed",
      "true",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Desfazer conclusão de Primeiro" }),
    );
    expect(findChecklist(element.id).content.items[0].completed).toBe(false);
  });

  it("edita, adiciona, remove e reordena itens", async () => {
    const element = insertChecklist();
    useEditorStore.getState().setEditingTextElementId(element.id);
    const { rerender } = render(<ChecklistElement element={element} />);

    const firstInput = screen.getByRole("textbox", { name: "Texto do item 1" });
    fireEvent.change(firstInput, { target: { value: "Primeiro editado" } });
    fireEvent.blur(firstInput);
    rerender(<ChecklistElement element={findChecklist(element.id)} />);
    await userEvent.click(screen.getByRole("button", { name: "Mover Primeiro editado para baixo" }));

    let updated = findChecklist(element.id);
    expect(updated.content.items.map((item) => item.text)).toEqual([
      "Segundo",
      "Primeiro editado",
    ]);

    rerender(<ChecklistElement element={updated} />);
    await userEvent.click(screen.getByRole("button", { name: "Adicionar item" }));
    updated = findChecklist(element.id);
    expect(updated.content.items).toHaveLength(3);

    rerender(<ChecklistElement element={updated} />);
    await userEvent.click(screen.getByRole("button", { name: "Excluir Novo item" }));
    expect(findChecklist(element.id).content.items).toHaveLength(2);
  });
});

function insertChecklist() {
  const element = createChecklistElement({
    title: "Hoje",
    items: [{ text: "Primeiro" }, { text: "Segundo" }],
  });
  const pageId = useDocumentStore.getState().activePageId;
  useDocumentStore.getState().addElement(pageId, element);
  return element;
}

function findChecklist(
  elementId: string,
): PageElement & { content: ChecklistElementContent } {
  const element = useDocumentStore
    .getState()
    .documents.flatMap((document) => document.pages)
    .flatMap((page) => page.elements)
    .find((candidate) => candidate.id === elementId);
  if (!element || element.content.kind !== "checklist") {
    throw new Error("Checklist não encontrada");
  }
  return element as PageElement & { content: ChecklistElementContent };
}
