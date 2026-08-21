import { describe, expect, it } from "vitest";
import { assetCatalog } from "../data/assetCatalog";
import { createElementFromAsset } from "./element.utils";
import { DEFAULT_PAGE_ASPECT_RATIO } from "./elementSizing.utils";

describe("createElementFromAsset", () => {
  it("preserva a imagem inteira e a proporção visual de stickers quadrados", () => {
    const element = createElementFromAsset(assetCatalog.stationerySheet);

    expect(element.type).toBe("sticker");
    expect(element.style.image?.objectFit).toBe("contain");
    expect(element.width).toBe(16);
    expect(element.height).toBeCloseTo(16 * DEFAULT_PAGE_ASPECT_RATIO, 2);
    expect(visualAspectRatio(element.width, element.height)).toBeCloseTo(1, 2);
  });

  it("usa as dimensões intrínsecas de imagens verticais", () => {
    const element = createElementFromAsset(assetCatalog.notepadReference);

    expect(element.style.image?.objectFit).toBe("contain");
    expect(visualAspectRatio(element.width, element.height)).toBeCloseTo(
      assetCatalog.notepadReference.width / assetCatalog.notepadReference.height,
      2,
    );
  });

  it("mantém stickers largos visíveis sem recorte", () => {
    const element = createElementFromAsset(assetCatalog.stickerSheet);

    expect(element.height).toBeGreaterThanOrEqual(element.minHeight ?? 0);
    expect(visualAspectRatio(element.width, element.height)).toBeCloseTo(
      assetCatalog.stickerSheet.width / assetCatalog.stickerSheet.height,
      2,
    );
  });
});

function visualAspectRatio(width: number, height: number): number {
  return (width * DEFAULT_PAGE_ASPECT_RATIO) / height;
}
