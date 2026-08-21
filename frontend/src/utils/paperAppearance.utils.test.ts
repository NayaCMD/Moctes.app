import { describe, expect, it } from "vitest";
import type { Page } from "../types/page.types";
import {
  BUILT_IN_PAPER_PRESETS,
  applyPaperAppearance,
  DEFAULT_PAPER_APPEARANCE,
  getPageAppearance,
  normalizePaperAppearance,
} from "./paperAppearance.utils";

function page(): Page {
  return {
    id: "page-1",
    documentId: "document-1",
    order: 1,
    paperType: "lined",
    paperColor: "#ffffff",
    patternColor: "#445566",
    patternOpacity: 20,
    patternSize: 24,
    elements: [],
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z",
  };
}

describe("paperAppearance", () => {
  it("normaliza documentos legados com textura e margens seguras", () => {
    expect(getPageAppearance(page())).toEqual({
      paperType: "lined",
      paperColor: "#ffffff",
      patternColor: "#445566",
      patternOpacity: 20,
      patternSize: 24,
      paperTexture: "none",
      textureIntensity: 16,
      margins: { top: 7, right: 7, bottom: 7, left: 7, visible: false },
    });
  });

  it("limita valores inválidos sem perder o fallback", () => {
    const normalized = normalizePaperAppearance({
      ...DEFAULT_PAPER_APPEARANCE,
      patternOpacity: 999,
      patternSize: -2,
      textureIntensity: 80,
      margins: { top: -1, right: 99, bottom: 8, left: 10, visible: true },
    });

    expect(normalized.patternOpacity).toBe(60);
    expect(normalized.patternSize).toBe(8);
    expect(normalized.textureIntensity).toBe(50);
    expect(normalized.margins).toEqual({ top: 0, right: 24, bottom: 8, left: 10, visible: true });
  });

  it("aplica um preset sem remover conteúdo da página", () => {
    const source = { ...page(), elements: [{ id: "element-1" }] as Page["elements"] };
    const result = applyPaperAppearance(source, BUILT_IN_PAPER_PRESETS[2].appearance);

    expect(result.paperType).toBe("grid");
    expect(result.paperTexture).toBe("grain");
    expect(result.elements).toBe(source.elements);
  });

  it("oferece presets para os quatro tipos de papel", () => {
    expect(new Set(BUILT_IN_PAPER_PRESETS.map((preset) => preset.appearance.paperType))).toEqual(
      new Set(["blank", "lined", "grid", "dotted"]),
    );
  });
});
