import type { Bounds } from "./coordinates.utils";

export function normalizeEraseArea(start: { x: number; y: number }, end: { x: number; y: number }): Bounds {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function elementCenterIntersectsArea(element: Bounds, area: Bounds): boolean {
  const center = {
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
  };

  return (
    center.x >= area.x &&
    center.x <= area.x + area.width &&
    center.y >= area.y &&
    center.y <= area.y + area.height
  );
}
