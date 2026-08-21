import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Page } from "../../types/page.types";
import { PaperSurface } from "./PaperSurface";

const page: Page = {
  id: "page-paper",
  documentId: "document-paper",
  order: 1,
  paperType: "grid",
  paperColor: "#fcf2e7",
  patternColor: "#617f9d",
  patternOpacity: 21,
  patternSize: 20,
  paperTexture: "fiber",
  textureIntensity: 27,
  margins: { top: 5, right: 6, bottom: 7, left: 12, visible: true },
  elements: [],
  createdAt: "2026-08-18T00:00:00.000Z",
  updatedAt: "2026-08-18T00:00:00.000Z",
};

describe("PaperSurface", () => {
  it("expõe textura, pauta e guias configuráveis sem capturar interação", () => {
    render(<PaperSurface page={page} label="Folha personalizada">conteúdo</PaperSurface>);
    const surface = screen.getByRole("region", { name: "Folha personalizada" });

    expect(surface).toHaveClass("paper-pattern-grid");
    expect(surface).toHaveAttribute("data-paper-texture", "fiber");
    expect(surface).toHaveAttribute("data-margin-guides", "true");
    expect(surface).toHaveStyle({
      "--user-paper-color": "#fcf2e7",
      "--paper-pattern-size": "20px",
      "--paper-margin-left": "12%",
    });
    expect(surface.querySelector(".paper-texture-layer")).toHaveAttribute("aria-hidden", "true");
    expect(surface.querySelector(".paper-margin-guide")).toHaveAttribute("aria-hidden", "true");
  });
});
