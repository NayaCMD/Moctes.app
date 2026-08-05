import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { TextToolbar } from "../editor/TextToolbar";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { resetStores } from "../../test/helpers/resetStores";
import { createPostItElement } from "../../utils/postIt.utils";
import { PostItElement } from "./PostItElement";

describe("post-it integration", () => {
  beforeEach(() => resetStores());

  it("insere, personaliza, edita e restaura post-it serializavel", async () => {
    const pageId = useDocumentStore.getState().activePageId;
    const element = createPostItElement({ templateId: "circle-dashed", x: 30, y: 30, text: "rascunho" });
    useDocumentStore.getState().addElement(pageId, element);
    useDocumentStore.getState().selectElement(element.id);

    const view = render(
      <>
        <PostItElement element={element} />
        <TextToolbar />
      </>,
    );

    fireEvent.change(screen.getByLabelText("Cor do fundo do post-it"), {
      target: { value: "#FFFFFF" },
    });
    await userEvent.click(screen.getByLabelText("Manter proporcao"));

    const customized = findElement(element.id);
    expect(customized).toMatchObject({
      lockAspectRatio: false,
      content: {
        kind: "post-it",
        appearance: {
          backgroundColor: "#ffffff",
          preserveAspectRatio: false,
        },
      },
    });

    act(() => {
      useEditorStore.getState().setEditingTextElementId(element.id);
    });
    view.rerender(
      <>
        <PostItElement element={customized ?? element} />
        <TextToolbar />
      </>,
    );
    const editor = screen.getByLabelText("Texto do post-it");
    await userEvent.clear(editor);
    await userEvent.type(editor, "texto final");
    await userEvent.tab();

    const snapshot = structuredClone(useDocumentStore.getState().documents);
    useDocumentStore.getState().applyDocumentsSnapshot(snapshot);
    expect(findElement(element.id)?.content).toMatchObject({
      kind: "post-it",
      text: "texto final",
      appearance: {
        templateId: "circle-dashed",
        backgroundColor: "#ffffff",
        preserveAspectRatio: false,
      },
    });
  });
});

function findElement(elementId: string) {
  return useDocumentStore
    .getState()
    .documents.flatMap((document) => document.pages)
    .flatMap((page) => page.elements)
    .find((item) => item.id === elementId);
}
