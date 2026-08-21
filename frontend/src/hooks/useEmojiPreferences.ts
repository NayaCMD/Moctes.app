import { useCallback, useState } from "react";
import {
  addRecentEmoji,
  loadEmojiPreferences,
  saveEmojiPreferences,
  toggleFavoriteEmoji,
} from "../services/emojiPreferences";
import type { EmojiPickerPreferences } from "../types/emoji.types";

export function useEmojiPreferences(scope: string) {
  const [snapshot, setSnapshot] = useState<{
    scope: string;
    preferences: EmojiPickerPreferences;
  }>(() => ({ scope, preferences: loadEmojiPreferences(scope) }));
  const preferences =
    snapshot.scope === scope ? snapshot.preferences : loadEmojiPreferences(scope);

  const update = useCallback(
    (updater: (current: EmojiPickerPreferences) => EmojiPickerPreferences) => {
      setSnapshot((current) => {
        const currentPreferences =
          current.scope === scope ? current.preferences : loadEmojiPreferences(scope);
        return {
          scope,
          preferences: saveEmojiPreferences(scope, updater(currentPreferences)),
        };
      });
    },
    [scope],
  );

  return {
    preferences,
    recordRecent: useCallback(
      (emojiId: string) => update((current) => addRecentEmoji(current, emojiId)),
      [update],
    ),
    toggleFavorite: useCallback(
      (emojiId: string) => update((current) => toggleFavoriteEmoji(current, emojiId)),
      [update],
    ),
    setKeepOpen: useCallback(
      (keepOpen: boolean) => update((current) => ({ ...current, keepOpen })),
      [update],
    ),
  };
}
