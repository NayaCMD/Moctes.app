import type { PointerEvent as ReactPointerEvent } from "react";
import type { ResizeHandlePosition } from "../../utils/elementBounds.utils";

interface ResizeHandlesProps {
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>, handle: ResizeHandlePosition) => void;
  disabled: boolean;
}

const handles: ResizeHandlePosition[] = [
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
  "top-left",
];

export function ResizeHandles({ onPointerDown, disabled }: ResizeHandlesProps) {
  return (
    <>
      {handles.map((handle) => (
        <button
          key={handle}
          type="button"
          className="resize-handle"
          data-handle={handle}
          aria-label={`Redimensionar ${handle}`}
          disabled={disabled}
          onPointerDown={(event) => onPointerDown(event, handle)}
        />
      ))}
    </>
  );
}
