import { describe, expect, it } from "vitest";
import {
  emojiCatalog,
  normalizeEmojiSearch,
  searchEmojiCatalog,
} from "./emojiCatalog";

describe("emojiCatalog", () => {
  it("mantem todas as categorias disponiveis offline", () => {
    expect(new Set(emojiCatalog.map((item) => item.category))).toEqual(
      new Set([
        "faces",
        "people",
        "animals",
        "food",
        "activities",
        "travel",
        "objects",
        "symbols",
      ]),
    );
    expect(emojiCatalog).toHaveLength(144);
    expect(emojiCatalog.every((item) => item.asset.kind === "font")).toBe(true);
  });

  it("busca nomes, shortcodes e sinonimos ignorando acentos", () => {
    expect(normalizeEmojiSearch("  Coração  ")).toBe("coracao");
    expect(searchEmojiCatalog("cão")).toContainEqual(
      expect.objectContaining({ id: "unicode:cachorro" }),
    );
    expect(searchEmojiCatalog("lampada")).toContainEqual(
      expect.objectContaining({ id: "unicode:lampada" }),
    );
    expect(searchEmojiCatalog("cafe da manha")).toContainEqual(
      expect.objectContaining({ id: "unicode:croissant" }),
    );
  });
});
