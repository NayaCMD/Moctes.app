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
    lockAspectRatioByDefault: true,
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

export function getEmojiFontSize(widthPercent: number, heightPercent: number): string {
  const smallerAxis = Math.max(4, Math.min(widthPercent, heightPercent));
  const preferredSize = Number((smallerAxis * 0.72).toFixed(2));
  return `clamp(18px, ${preferredSize}cqi, 92px)`;
}

export function getEmojiFontSizePx(containerWidth: number, containerHeight: number): number {
  const smallerAxis = Math.min(containerWidth, containerHeight);
  return Math.max(16, Math.min(160, Math.round(smallerAxis * 0.82)));
}
