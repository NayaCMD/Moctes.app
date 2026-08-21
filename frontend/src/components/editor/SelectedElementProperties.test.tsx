import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { resetStores } from "../../test/helpers/resetStores";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { SelectedElementProperties } from "./SelectedElementProperties";

describe("SelectedElementProperties para tapes", () => {
  beforeEach(() => resetStores());

  it("edita preenchimento, borda, opacidade e camada", async () => {
    const user = userEvent.setup();
    const tape = findFirstTape();
    useDocumentStore.setState({ selectedElementId: tape.id });

    render(<SelectedElementProperties />);

    await user.click(screen.getByRole("button", { name: "Recortar" }));
    await user.click(screen.getByRole("button", { name: "Rústica" }));
    fireEvent.change(screen.getByRole("slider", { name: "Opacidade" }), {
      target: { value: "48" },
    });
    await user.click(screen.getByRole("button", { name: /Sobre tudo/i }));

    const updated = findElement(tape.id);
    expect(updated.content).toMatchObject({
      kind: "tape",
      renderMode: "crop",
      edgeStyle: "torn-rough",
    });
    expect(updated.style.image?.opacity).toBe(0.48);

    const page = useDocumentStore
      .getState()
      .documents.flatMap((document) => document.pages)
      .find((candidate) => candidate.elements.some((element) => element.id === tape.id));
    expect(updated.zIndex).toBe(Math.max(...(page?.elements.map((element) => element.zIndex) ?? [])));
  });

  it("converte texto em checklist e checklist novamente em texto", async () => {
    const user = userEvent.setup();
    const textElement = useDocumentStore
      .getState()
      .documents.flatMap((document) => document.pages)
      .flatMap((page) => page.elements)
      .find((element) => element.content.kind === "text" && element.content.text.includes("Hoje"));
    if (!textElement) throw new Error("Fixture sem texto");
    useDocumentStore.setState({ selectedElementId: textElement.id });

    render(<SelectedElementProperties />);
    await user.click(screen.getByRole("button", { name: "Converter em checklist" }));

    let converted = findElement(textElement.id);
    expect(converted.type).toBe("checklist");
    expect(converted.content.kind).toBe("checklist");

    await user.click(screen.getByRole("button", { name: "Converter em texto" }));
    converted = findElement(textElement.id);
    expect(converted.type).toBe("text");
    expect(converted.content).toMatchObject({ kind: "text" });
  });
});

function findFirstTape() {
  const tape = useDocumentStore
    .getState()
    .documents.flatMap((document) => document.pages)
    .flatMap((page) => page.elements)
    .find((element) => element.type === "tape");
  if (!tape) throw new Error("Fixture sem tape");
  return tape;
}

function findElement(elementId: string) {
  const element = useDocumentStore
    .getState()
    .documents.flatMap((document) => document.pages)
    .flatMap((page) => page.elements)
    .find((candidate) => candidate.id === elementId);
  if (!element) throw new Error(`Elemento ${elementId} não encontrado`);
  return element;
}
