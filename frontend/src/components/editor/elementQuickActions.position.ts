import { clamp } from "../../utils/coordinates.utils";

interface PositionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PositionBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface ToolbarPosition {
  left: number;
  top: number;
}

const ELEMENT_GAP = 12;

interface ViewportSize {
  width: number;
  height: number;
}

export function calculateQuickActionsPosition(
  anchor: PositionRect,
  toolbar: Pick<PositionRect, "width" | "height">,
  bounds: PositionBounds,
): ToolbarPosition {
  const maxLeft = Math.max(bounds.left, bounds.right - toolbar.width);
  const preferredLeft = anchor.left + anchor.width / 2 - toolbar.width / 2;
  const left = clamp(preferredLeft, bounds.left, maxLeft);
  const anchorBottom = anchor.top + anchor.height;
  const spaceAbove = anchor.top - bounds.top;
  const spaceBelow = bounds.bottom - anchorBottom;
  const requiredSpace = toolbar.height + ELEMENT_GAP;
  const placeAbove = spaceAbove >= requiredSpace || spaceAbove >= spaceBelow;
  const preferredTop = placeAbove
    ? anchor.top - requiredSpace
    : anchorBottom + ELEMENT_GAP;
  const maxTop = Math.max(bounds.top, bounds.bottom - toolbar.height);

  return {
    left,
    top: clamp(preferredTop, bounds.top, maxTop),
  };
}

export function calculateContextMenuOrigin(
  toolbar: PositionRect,
  viewport: ViewportSize,
  menu = { width: 224, height: 448 },
): ToolbarPosition {
  const edge = 8;
  const gap = 8;
  const maxTop = Math.max(edge, viewport.height - menu.height - edge);
  const top = clamp(toolbar.top, edge, maxTop);

  if (toolbar.left + toolbar.width + gap + menu.width <= viewport.width - edge) {
    return { left: toolbar.left + toolbar.width + gap, top };
  }

  if (toolbar.left - gap - menu.width >= edge) {
    return { left: toolbar.left - gap - menu.width, top };
  }

  const maxLeft = Math.max(edge, viewport.width - menu.width - edge);
  const below = toolbar.top + toolbar.height + gap;
  const above = toolbar.top - menu.height - gap;
  const preferredTop = below + menu.height <= viewport.height - edge ? below : above;

  return {
    left: clamp(toolbar.left, edge, maxLeft),
    top: clamp(preferredTop, edge, maxTop),
  };
}
