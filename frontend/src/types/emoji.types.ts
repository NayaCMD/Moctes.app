import type { EmojiAssetReference, EmojiProvider } from "./element.types";

export type EmojiCategoryId =
  | "faces"
  | "people"
  | "animals"
  | "food"
  | "activities"
  | "travel"
  | "objects"
  | "symbols";

export type EmojiPickerSectionId = "recent" | "favorites" | EmojiCategoryId;

export interface EmojiCatalogItem {
  id: string;
  provider: EmojiProvider;
  shortcode: string;
  emoji: string;
  name: string;
  keywords: string[];
  category: EmojiCategoryId;
  asset: EmojiAssetReference;
}

export interface EmojiPickerPreferences {
  recentIds: string[];
  favoriteIds: string[];
  keepOpen: boolean;
}
