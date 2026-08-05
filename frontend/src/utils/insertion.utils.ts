import type { PageElement, PageElementType } from "../types/element.types";
import type { Bounds, PageSafeArea } from "./coordinates.utils";
import { DEFAULT_SAFE_AREA, keepBoundsInsidePage } from "./coordinates.utils";
import { keepRotatedBoundsInsideSafeArea } from "./elementBounds.utils";

export const INSERT_OFFSET = 3;

export const DEFAULT_ELEMENT_SIZES: Record<
  Exclude<PageElementType, "drawing">,
  { width: number; height: number }
> = {
  text: { width: 24, height: 8 },
  emoji: { width: 8, height: 8 },
  shape: { width: 16, height: 16 },
  sticker: { width: 16, height: 16 },
  image: { width: 24, height: 24 },
  tape: { width: 26, height: 7 },
  "post-it": { width: 20, height: 20 },
  comment: { width: 12, height: 8 },
};

export function getDefaultElementSize(type: PageElementType): { width: number; height: number } {
  if (type === "drawing") {
    return { width: 18, height: 12 };
  }
  return DEFAULT_ELEMENT_SIZES[type];
}

export function resolveInsertionBounds(options: {
  existingElements: PageElement[];
  size: { width: number; height: number };
  preferredPosition?: { x: number; y: number };
  safeArea?: PageSafeArea;
  rotation?: number;
}): Bounds {
  const safeArea = options.safeArea ?? DEFAULT_SAFE_AREA;
  const base = options.preferredPosition
    ? {
        x: options.preferredPosition.x,
        y: options.preferredPosition.y,
        width: options.size.width,
        height: options.size.height,
      }
    : {
        x: 50 - options.size.width / 2,
        y: 48 - options.size.height / 2,
        width: options.size.width,
        height: options.size.height,
      };
  const start = keepRotatedBoundsInsideSafeArea(base, options.rotation ?? 0, safeArea);

  for (let step = 0; step < 48; step += 1) {
    const row = Math.floor(step / 8);
    const column = step % 8;
    const candidate = keepRotatedBoundsInsideSafeArea(
      {
        ...start,
        x: start.x + column * INSERT_OFFSET,
        y: start.y + row * INSERT_OFFSET,
      },
      options.rotation ?? 0,
      safeArea,
    );

    if (!hasCompleteOverlap(candidate, options.existingElements)) {
      return candidate;
    }
  }

  return keepBoundsInsidePage(start, safeArea);
}

export function placeElementForInsertion(options: {
  element: PageElement;
  existingElements: PageElement[];
  preferredPosition?: { x: number; y: number };
  safeArea?: PageSafeArea;
}): PageElement {
  const bounds = resolveInsertionBounds({
    existingElements: options.existingElements,
    preferredPosition: options.preferredPosition,
    safeArea: options.safeArea,
    rotation: options.element.rotation,
    size: { width: options.element.width, height: options.element.height },
  });

  return {
    ...options.element,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function hasCompleteOverlap(bounds: Bounds, elements: PageElement[]): boolean {
  return elements.some(
    (element) =>
      Math.abs(element.x - bounds.x) < 1 &&
      Math.abs(element.y - bounds.y) < 1 &&
      Math.abs(element.width - bounds.width) < 1 &&
      Math.abs(element.height - bounds.height) < 1,
  );
}
