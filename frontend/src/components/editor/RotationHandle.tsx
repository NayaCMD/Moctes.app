import type { PointerEvent as ReactPointerEvent } from "react";

interface RotationHandleProps {
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  disabled: boolean;
}

export function RotationHandle({ onPointerDown, disabled }: RotationHandleProps) {
  return (
    <button
      type="button"
      className="rotation-handle"
      aria-label="Rotacionar elemento"
      disabled={disabled}
      onPointerDown={onPointerDown}
    />
  );
}
