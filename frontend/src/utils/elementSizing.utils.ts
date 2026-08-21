import type { PageElementType } from "../types/element.types";

export interface ElementSizingBehavior {
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  maxHeight?: number;
  lockAspectRatioByDefault: boolean;
  resizable: boolean;
}

export const ELEMENT_SIZING: Record<PageElementType, ElementSizingBehavior> = {
  text: {
    defaultWidth: 24,
    defaultHeight: 8,
    minWidth: 8,
    minHeight: 4,
    lockAspectRatioByDefault: false,
    resizable: true,
  },
  emoji: {
    defaultWidth: 8,
    defaultHeight: 8,
    minWidth: 5,
    minHeight: 5,
    lockAspectRatioByDefault: true,
    resizable: true,
  },
  shape: {
    defaultWidth: 16,
    defaultHeight: 16,
    minWidth: 5,
    minHeight: 4,
    lockAspectRatioByDefault: false,
    resizable: true,
  },
  sticker: {
    defaultWidth: 16,
    defaultHeight: 16,
    minWidth: 8,
    minHeight: 8,
    lockAspectRatioByDefault: true,
    resizable: true,
  },
  image: {
    defaultWidth: 24,
    defaultHeight: 24,
    minWidth: 8,
    minHeight: 8,
    lockAspectRatioByDefault: true,
    resizable: true,
  },
  tape: {
    defaultWidth: 26,
    defaultHeight: 7,
    minWidth: 10,
    minHeight: 3,
    lockAspectRatioByDefault: false,
    resizable: true,
  },
  checklist: {
    defaultWidth: 34,
    defaultHeight: 24,
    minWidth: 18,
    minHeight: 10,
    lockAspectRatioByDefault: false,
    resizable: true,
  },
  "post-it": {
    defaultWidth: 20,
    defaultHeight: 20,
    minWidth: 8,
    minHeight: 8,
    lockAspectRatioByDefault: true,
    resizable: true,
  },
  comment: {
    defaultWidth: 6,
    defaultHeight: 6,
    minWidth: 4,
    minHeight: 4,
    maxWidth: 8,
    maxHeight: 8,
    lockAspectRatioByDefault: true,
    resizable: false,
  },
  drawing: {
    defaultWidth: 100,
    defaultHeight: 100,
    minWidth: 10,
    minHeight: 10,
    lockAspectRatioByDefault: false,
    resizable: true,
  },
};

export function getElementSizing(type: PageElementType): ElementSizingBehavior {
  return ELEMENT_SIZING[type];
}

// All editor page variants use approximately the same portrait proportion.
// Element bounds are percentages, so a visually square asset needs a smaller
// height percentage than width percentage.
export const DEFAULT_PAGE_ASPECT_RATIO = 312 / 430;

export function getAssetElementDimensions(options: {
  type: "image" | "sticker";
  intrinsicWidth?: number;
  intrinsicHeight?: number;
}): { width: number; height: number } {
  const sizing = getElementSizing(options.type);
  const hasIntrinsicSize =
    Number.isFinite(options.intrinsicWidth) &&
    Number.isFinite(options.intrinsicHeight) &&
    (options.intrinsicWidth ?? 0) > 0 &&
    (options.intrinsicHeight ?? 0) > 0;
  const intrinsicRatio = hasIntrinsicSize
    ? (options.intrinsicWidth as number) / (options.intrinsicHeight as number)
    : 1;
  const visualRatio = Math.min(3, Math.max(0.5, intrinsicRatio));

  let width = sizing.defaultWidth;
  let height = (width * DEFAULT_PAGE_ASPECT_RATIO) / visualRatio;

  if (height < sizing.minHeight) {
    height = sizing.minHeight;
    width = (height * visualRatio) / DEFAULT_PAGE_ASPECT_RATIO;
  }
  if (width < sizing.minWidth) {
    width = sizing.minWidth;
    height = (width * DEFAULT_PAGE_ASPECT_RATIO) / visualRatio;
  }

  return {
    width: Number(width.toFixed(2)),
    height: Number(height.toFixed(2)),
  };
}

export function getEmojiFontSize(widthPercent: number, heightPercent: number): string {
  const smallerAxis = Math.max(4, Math.min(widthPercent, heightPercent));
  const preferredSize = Number((smallerAxis * 0.72).toFixed(2));
  return `clamp(18px, ${preferredSize}cqi, 92px)`;
}

export function getEmojiFontSizePx(containerWidth: number, containerHeight: number): number {
  const smallerAxis = Math.min(containerWidth, containerHeight);
  return Math.max(16, Math.min(160, Math.round(smallerAxis * 0.82)));
}
