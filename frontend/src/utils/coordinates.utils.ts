export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageSafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_SAFE_AREA: PageSafeArea = {
  top: 2,
  right: 2,
  bottom: 2,
  left: 2,
};

export const LEFT_PAGE_SAFE_AREA: PageSafeArea = {
  top: 2,
  right: 4,
  bottom: 2,
  left: 2,
};

export const RIGHT_PAGE_SAFE_AREA: PageSafeArea = {
  top: 2,
  right: 2,
  bottom: 2,
  left: 4,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function pointerToPagePercent(
  event: Pick<PointerEvent, "clientX" | "clientY">,
  pageRect: DOMRect,
): Point {
  return {
    x: clamp(((event.clientX - pageRect.left) / pageRect.width) * 100, 0, 100),
    y: clamp(((event.clientY - pageRect.top) / pageRect.height) * 100, 0, 100),
  };
}

export function keepBoundsInsidePage(
  bounds: Bounds,
  safeArea: PageSafeArea = DEFAULT_SAFE_AREA,
): Bounds {
  const width = clamp(bounds.width, 1, 100);
  const height = clamp(bounds.height, 1, 100);
  const minX = safeArea.left;
  const minY = safeArea.top;
  const maxX = 100 - safeArea.right - width;
  const maxY = 100 - safeArea.bottom - height;

  return {
    x: clamp(bounds.x, minX, Math.max(minX, maxX)),
    y: clamp(bounds.y, minY, Math.max(minY, maxY)),
    width,
    height,
  };
}

export function getCenter(bounds: Bounds): Point {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}
