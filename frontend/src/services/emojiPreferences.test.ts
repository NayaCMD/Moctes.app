import { beforeEach, describe, expect, it } from "vitest";
import {
  addRecentEmoji,
  defaultEmojiPreferences,
  loadEmojiPreferences,
  saveEmojiPreferences,
  toggleFavoriteEmoji,
} from "./emojiPreferences";

describe("emojiPreferences", () => {
  beforeEach(() => window.localStorage.clear());

  it("salva preferencias em um escopo por usuario", () => {
    saveEmojiPreferences("user-1", {
      recentIds: ["unicode:cafe"],
      favoriteIds: ["unicode:estrela"],
      keepOpen: true,
    });

    expect(loadEmojiPreferences("user-1")).toEqual({
      recentIds: ["unicode:cafe"],
      favoriteIds: ["unicode:estrela"],
      keepOpen: true,
    });
    expect(loadEmojiPreferences("user-2")).toEqual(defaultEmojiPreferences);
  });

  it("ordena recentes, remove repeticoes e alterna favoritos", () => {
    const withRecent = addRecentEmoji(
      { ...defaultEmojiPreferences, recentIds: ["a", "b"] },
      "b",
    );
    expect(withRecent.recentIds).toEqual(["b", "a"]);

    const favorited = toggleFavoriteEmoji(withRecent, "b");
    expect(favorited.favoriteIds).toEqual(["b"]);
    expect(toggleFavoriteEmoji(favorited, "b").favoriteIds).toEqual([]);
  });
});
