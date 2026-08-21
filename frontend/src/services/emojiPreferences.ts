import type { EmojiPickerPreferences } from "../types/emoji.types";

const STORAGE_PREFIX = "moctes:emoji-picker:v2";
const MAX_RECENT = 24;
const MAX_FAVORITES = 96;

export const defaultEmojiPreferences: EmojiPickerPreferences = {
  recentIds: [],
  favoriteIds: [],
  keepOpen: false,
};

function storageKey(scope: string): string {
  const safeScope = scope.trim() || "anonymous";
  return `${STORAGE_PREFIX}:${safeScope}`;
}

function uniqueIds(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [...new Set(value.filter((item): item is string => typeof item === "string"))].slice(
    0,
    limit,
  );
}

export function loadEmojiPreferences(scope: string): EmojiPickerPreferences {
  if (typeof window === "undefined") {
    return defaultEmojiPreferences;
  }
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) {
      return defaultEmojiPreferences;
    }
    const parsed = JSON.parse(raw) as Partial<EmojiPickerPreferences>;
    return {
      recentIds: uniqueIds(parsed.recentIds, MAX_RECENT),
      favoriteIds: uniqueIds(parsed.favoriteIds, MAX_FAVORITES),
      keepOpen: parsed.keepOpen === true,
    };
  } catch {
    return defaultEmojiPreferences;
  }
}

export function saveEmojiPreferences(
  scope: string,
  preferences: EmojiPickerPreferences,
): EmojiPickerPreferences {
  const normalized = {
    recentIds: uniqueIds(preferences.recentIds, MAX_RECENT),
    favoriteIds: uniqueIds(preferences.favoriteIds, MAX_FAVORITES),
    keepOpen: preferences.keepOpen,
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKey(scope), JSON.stringify(normalized));
  }
  return normalized;
}

export function addRecentEmoji(
  preferences: EmojiPickerPreferences,
  emojiId: string,
): EmojiPickerPreferences {
  return {
    ...preferences,
    recentIds: [emojiId, ...preferences.recentIds.filter((id) => id !== emojiId)].slice(
      0,
      MAX_RECENT,
    ),
  };
}

export function toggleFavoriteEmoji(
  preferences: EmojiPickerPreferences,
  emojiId: string,
): EmojiPickerPreferences {
  const favoriteIds = preferences.favoriteIds.includes(emojiId)
    ? preferences.favoriteIds.filter((id) => id !== emojiId)
    : [emojiId, ...preferences.favoriteIds].slice(0, MAX_FAVORITES);
  return { ...preferences, favoriteIds };
}
