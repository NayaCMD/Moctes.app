import type { Bounds } from "../../utils/coordinates.utils";

interface EraseAreaOverlayProps {
  area: Bounds | null;
}

export function EraseAreaOverlay({ area }: EraseAreaOverlayProps) {
  if (!area) {
    return null;
  }

  return (
    <div
      className="erase-area-overlay"
      style={{
        left: `${area.x}%`,
        top: `${area.y}%`,
        width: `${area.width}%`,
        height: `${area.height}%`,
      }}
      aria-hidden="true"
    />
  );
}
