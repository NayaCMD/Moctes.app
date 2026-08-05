import type { Bounds, PageSafeArea, Point } from "./coordinates.utils";
import {
  DEFAULT_SAFE_AREA,
  clamp,
  keepBoundsInsidePage,
  normalizeAngle,
} from "./coordinates.utils";

export type ResizeHandlePosition =
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top-left"
  | "top-right"
  | "bottom-right"
  | "bottom-left";

export function moveBounds(
  initial: Bounds,
  initialPointer: Point,
  currentPointer: Point,
  safeArea: PageSafeArea = DEFAULT_SAFE_AREA,
  rotation = 0,
): Bounds {
  return keepRotatedBoundsInsideSafeArea({
    ...initial,
    x: initial.x + currentPointer.x - initialPointer.x,
    y: initial.y + currentPointer.y - initialPointer.y,
  }, rotation, safeArea);
}

export function resizeBounds(options: {
  initial: Bounds;
  initialPointer: Point;
  currentPointer: Point;
  handle: ResizeHandlePosition;
  minWidth: number;
  minHeight: number;
  lockAspectRatio: boolean;
  safeArea?: PageSafeArea;
  rotation?: number;
}): Bounds {
  const dx = options.currentPointer.x - options.initialPointer.x;
  const dy = options.currentPointer.y - options.initialPointer.y;
  let { x, y, width, height } = options.initial;

  if (options.handle.includes("right")) {
    width += dx;
  }
  if (options.handle.includes("left")) {
    x += dx;
    width -= dx;
  }
  if (options.handle.includes("bottom")) {
    height += dy;
  }
  if (options.handle.includes("top")) {
    y += dy;
    height -= dy;
  }

  width = Math.max(options.minWidth, width);
  height = Math.max(options.minHeight, height);

  if (options.lockAspectRatio) {
    const ratio = options.initial.width / options.initial.height;
    if (Math.abs(dx) > Math.abs(dy)) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }
  }

  return keepRotatedBoundsInsideSafeArea(
    { x, y, width, height },
    options.rotation ?? 0,
    options.safeArea ?? DEFAULT_SAFE_AREA,
  );
}

export function rotationFromPointer(options: {
  pageRect: DOMRect;
  element: Bounds;
  pointerClientX: number;
  pointerClientY: number;
  snap: boolean;
}): number {
  const center = {
    x:
      options.pageRect.left +
      ((options.element.x + options.element.width / 2) / 100) * options.pageRect.width,
    y:
      options.pageRect.top +
      ((options.element.y + options.element.height / 2) / 100) * options.pageRect.height,
  };
  const radians = Math.atan2(options.pointerClientY - center.y, options.pointerClientX - center.x);
  const degrees = normalizeAngle((radians * 180) / Math.PI + 90);
  return options.snap ? Math.round(degrees / 15) * 15 : degrees;
}

export function nudgeBounds(
  bounds: Bounds,
  dx: number,
  dy: number,
  safeArea: PageSafeArea = DEFAULT_SAFE_AREA,
  rotation = 0,
): Bounds {
  return keepRotatedBoundsInsideSafeArea(
    {
      ...bounds,
      x: clamp(bounds.x + dx, 0, 100 - bounds.width),
      y: clamp(bounds.y + dy, 0, 100 - bounds.height),
    },
    rotation,
    safeArea,
  );
}

export function getRotatedVisualBounds(bounds: Bounds, rotation: number): Bounds {
  const radians = (normalizeAngle(rotation) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const visualWidth = bounds.width * cos + bounds.height * sin;
  const visualHeight = bounds.width * sin + bounds.height * cos;
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  return {
    x: centerX - visualWidth / 2,
    y: centerY - visualHeight / 2,
    width: visualWidth,
    height: visualHeight,
  };
}

export function keepRotatedBoundsInsideSafeArea(
  bounds: Bounds,
  rotation: number,
  safeArea: PageSafeArea = DEFAULT_SAFE_AREA,
): Bounds {
  const next = keepBoundsInsidePage(bounds, safeArea);
  const visual = getRotatedVisualBounds(next, rotation);
  const minX = safeArea.left;
  const minY = safeArea.top;
  const maxRight = 100 - safeArea.right;
  const maxBottom = 100 - safeArea.bottom;
  let x = next.x;
  let y = next.y;

  if (visual.x < minX) {
    x += minX - visual.x;
  }
  if (visual.y < minY) {
    y += minY - visual.y;
  }
  if (visual.x + visual.width > maxRight) {
    x -= visual.x + visual.width - maxRight;
  }
  if (visual.y + visual.height > maxBottom) {
    y -= visual.y + visual.height - maxBottom;
  }

  return keepBoundsInsidePage({ ...next, x, y }, safeArea);
}

export function constrainRotation(
  bounds: Bounds,
  desiredRotation: number,
  safeArea: PageSafeArea = DEFAULT_SAFE_AREA,
): number {
  const normalized = normalizeAngle(desiredRotation);
  const visual = getRotatedVisualBounds(bounds, normalized);
  const outside =
    visual.x < safeArea.left ||
    visual.y < safeArea.top ||
    visual.x + visual.width > 100 - safeArea.right ||
    visual.y + visual.height > 100 - safeArea.bottom;

  return outside ? boundsRotationFallback(bounds, normalized, safeArea) : normalized;
}

function boundsRotationFallback(
  bounds: Bounds,
  rotation: number,
  safeArea: PageSafeArea,
): number {
  for (let distance = 0; distance <= 180; distance += 5) {
    for (const candidate of [rotation - distance, rotation + distance]) {
      const normalized = normalizeAngle(candidate);
      const visual = getRotatedVisualBounds(bounds, normalized);
      const fits =
        visual.x >= safeArea.left &&
        visual.y >= safeArea.top &&
        visual.x + visual.width <= 100 - safeArea.right &&
        visual.y + visual.height <= 100 - safeArea.bottom;
      if (fits) {
        return normalized;
      }
    }
  }

  return 0;
}
