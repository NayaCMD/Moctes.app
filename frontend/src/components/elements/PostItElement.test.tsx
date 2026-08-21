import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { resetStores } from "../../test/helpers/resetStores";
import type { PageElement } from "../../types/element.types";
import { createPostItElement } from "../../utils/postIt.utils";
import { PostItElement } from "./PostItElement";

function addPostIt(overrides: Partial<PageElement> = {}) {
  const element = { ...createPostItElement({ x: 20, y: 20, text: "minha nota" }), ...overrides };
  useDocumentStore.getState().addElement(useDocumentStore.getState().activePageId, element);
  return element;
}

describe("PostItElement", () => {
  beforeEach(() => resetStores());

  it("renderiza template e texto em camada HTML", () => {
    const element = addPostIt();
    render(<PostItElement element={element} />);

    expect(document.querySelector(".post-it-element__background")).toBeInTheDocument();
    expect(screen.getByText("minha nota")).toBeInTheDocument();
    expect(document.querySelector("svg")?.textContent).not.toContain("minha nota");
  });

  it("aplica cores da aparencia", () => {
    const element = addPostIt({
      content: {
        kind: "post-it",
        text: "colorido",
        appearance: {
          templateId: "circle-dashed",
          backgroundColor: "#FFFFFF",
          patternColor: "#123456",
          textColor: "#654321",
          patternOpacity: 0.5,
          preserveAspectRatio: true,
        },
      },
    });
    render(<PostItElement element={element} />);

    expect(document.querySelector("rect[fill='#FFFFFF']")).toBeInTheDocument();
    expect(screen.getByText("colorido")).toHaveStyle({ color: "#654321" });
  });

  it("edita texto e salva no store", async () => {
    const element = addPostIt();
    useEditorStore.getState().setEditingTextElementId(element.id);
    render(<PostItElement element={element} />);

    const editor = screen.getByLabelText("Texto do post-it");
    await userEvent.clear(editor);
    await userEvent.type(editor, "novo texto");
    await userEvent.tab();

    const updated = useDocumentStore
      .getState()
      .documents.flatMap((document) => document.pages)
      .flatMap((page) => page.elements)
      .find((item) => item.id === element.id);
    expect(updated?.content).toMatchObject({ kind: "post-it", text: "novo texto" });
  });

  it("exibe fallback para template inexistente", () => {
    const element = addPostIt({
      content: {
        kind: "post-it",
        text: "fallback",
        appearance: {
          templateId: "ticket",
          backgroundColor: "#D3E7FF",
          patternColor: "#8EC2FF",
          textColor: "#315E91",
          patternOpacity: 1,
          preserveAspectRatio: true,
        },
      },
    });
    render(<PostItElement element={element} />);

    expect(screen.getByText("Template indisponível")).toBeInTheDocument();
    expect(screen.getByText("fallback")).toBeInTheDocument();
  });
});
