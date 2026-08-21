import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { assetCatalog } from "../../data/assetCatalog";
import { resetStores } from "../../test/helpers/resetStores";
import type { PageElement } from "../../types/element.types";
import { TapeElement } from "./TapeElement";

describe("TapeElement", () => {
  beforeEach(() => resetStores());

  it("repete o padrão horizontalmente sem deformar a origem", () => {
    render(<TapeElement element={tapeElement()} />);

    const tape = screen.getByRole("img", { name: "Tape de teste" });
    expect(tape).toHaveAttribute("data-render-mode", "repeat");
    expect(tape).toHaveAttribute("data-edge", "torn-soft");
    expect(tape).toHaveStyle({ opacity: "0.62" });
    expect(tape.style.backgroundImage).toContain("tape-form.png");
  });

  it("renderiza recorte e borda reta configurados", () => {
    const element = tapeElement();
    if (element.content.kind !== "tape") throw new Error("Fixture inválida");
    element.content = {
      ...element.content,
      renderMode: "crop",
      edgeStyle: "straight",
    };

    render(<TapeElement element={element} />);

    const tape = screen.getByRole("img", { name: "Tape de teste" });
    expect(tape).toHaveAttribute("data-render-mode", "crop");
    expect(tape).toHaveAttribute("data-edge", "straight");
  });
});

function tapeElement(): PageElement {
  return {
    id: "tape-element",
    type: "tape",
    x: 12,
    y: 18,
    width: 44,
    height: 8,
    rotation: -4,
    zIndex: 4,
    locked: false,
    hidden: false,
    lockAspectRatio: false,
    content: {
      kind: "tape",
      assetId: assetCatalog.tapeBlue.id,
      src: assetCatalog.tapeBlue.src,
      alt: "Tape de teste",
      renderMode: "repeat",
      edgeStyle: "torn-soft",
    },
    style: { image: { opacity: 0.62, borderRadius: 4 } },
  };
}
