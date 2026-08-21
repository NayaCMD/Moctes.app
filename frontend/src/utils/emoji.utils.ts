import type { EmojiCatalogItem } from "../types/emoji.types";
import type { PageElement } from "../types/element.types";
import type { PageSafeArea } from "./coordinates.utils";
import { DEFAULT_SAFE_AREA, pointerToPagePercent } from "./coordinates.utils";
import { getCenteredDropBounds } from "./assetDrop.utils";
import { getElementSizing } from "./elementSizing.utils";
import { placeElementForInsertion } from "./insertion.utils";

export function createEmojiElement(item: EmojiCatalogItem): PageElement {
  const sizing = getElementSizing("emoji");
  return {
    id: `el-${crypto.randomUUID()}`,
    type: "emoji",
    x: 40,
    y: 40,
    width: sizing.defaultWidth,
    height: sizing.defaultHeight,
    minWidth: sizing.minWidth,
    minHeight: sizing.minHeight,
    lockAspectRatio: sizing.lockAspectRatioByDefault,
    rotation: 0,
    zIndex: 10,
    locked: false,
    hidden: false,
    content: {
      kind: "emoji",
      emoji: item.emoji,
      provider: item.provider,
      emojiId: item.id,
      shortcode: item.shortcode,
      label: item.name,
      asset: item.asset,
    },
    style: { text: { textAlign: "center" } },
  };
}

export function createEmojiElementFromDrop(options: {
  item: EmojiCatalogItem;
  clientX: number;
  clientY: number;
  pageRect: DOMRect;
  existingElements: PageElement[];
  safeArea?: PageSafeArea;
}): PageElement {
  const element = createEmojiElement(options.item);
  const pointer = pointerToPagePercent(
    { clientX: options.clientX, clientY: options.clientY },
    options.pageRect,
  );
  const bounds = getCenteredDropBounds({
    pointer,
    element,
    safeArea: options.safeArea ?? DEFAULT_SAFE_AREA,
  });

  return placeElementForInsertion({
    element,
    existingElements: options.existingElements,
    preferredPosition: { x: bounds.x, y: bounds.y },
    safeArea: options.safeArea,
  });
}
