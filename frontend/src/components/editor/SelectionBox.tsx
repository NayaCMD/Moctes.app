import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Lock } from "lucide-react";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type { PageElement } from "../../types/element.types";
import { DEFAULT_SAFE_AREA, pointerToPagePercent } from "../../utils/coordinates.utils";
import type { ResizeHandlePosition } from "../../utils/elementBounds.utils";
import {
  constrainRotation,
  resizeBounds,
  rotationFromPointer,
} from "../../utils/elementBounds.utils";
import { ResizeHandles } from "./ResizeHandles";
import { RotationHandle } from "./RotationHandle";
import { getElementSizing } from "../../utils/elementSizing.utils";

interface SelectionBoxProps {
  element: PageElement;
  pageElement: HTMLElement;
}

export function SelectionBox({ element, pageElement }: SelectionBoxProps) {
  const documents = useDocumentStore((state) => state.documents);
  const updateElement = useDocumentStore((state) => state.updateElement);
  const beginInteraction = useEditorStore((state) => state.beginInteraction);
  const updatePreview = useEditorStore((state) => state.updatePreview);
  const endInteraction = useEditorStore((state) => state.endInteraction);
  const recordHistory = useEditorStore((state) => state.recordHistory);
  const interaction = useEditorStore((state) => state.interaction);
  const preview = interaction.elementId === element.id ? interaction.preview : null;
  const current = { ...element, ...preview };
  const style: CSSProperties = {
    left: `${current.x}%`,
    top: `${current.y}%`,
    width: `${current.width}%`,
    height: `${current.height}%`,
    transform: `rotate(${current.rotation}deg)`,
  };
  const disabled = element.locked;
  const sizing = getElementSizing(element.type);
  const canResize = !disabled && sizing.resizable;

  const startResize = (
    event: ReactPointerEvent<HTMLButtonElement>,
    handle: ResizeHandlePosition,
  ) => {
    if (disabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const pageRect = pageElement.getBoundingClientRect();
    const initialPointer = pointerToPagePercent(event.nativeEvent, pageRect);
    const initial = {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    };
    let changed = false;

    const handleMove = (moveEvent: PointerEvent) => {
      const currentPointer = pointerToPagePercent(moveEvent, pageRect);
      const next = resizeBounds({
        initial,
        initialPointer,
        currentPointer,
        handle,
        minWidth: element.minWidth ?? 4,
        minHeight: element.minHeight ?? 4,
        lockAspectRatio:
          moveEvent.shiftKey || element.lockAspectRatio || element.type === "image" || element.type === "sticker",
        rotation: element.rotation,
        safeArea: DEFAULT_SAFE_AREA,
      });
      const hasChanged =
        Math.abs(next.x - initial.x) > 0.1 ||
        Math.abs(next.y - initial.y) > 0.1 ||
        Math.abs(next.width - initial.width) > 0.1 ||
        Math.abs(next.height - initial.height) > 0.1;
      if (!hasChanged && !changed) {
        return;
      }
      if (!changed) {
        recordHistory(documents);
        beginInteraction({ mode: "resizing", elementId: element.id, preview: {} });
        changed = true;
      }
      updatePreview(next);
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      const next = useEditorStore.getState().interaction.preview;
      if (changed && next) {
        updateElement(element.id, next);
      }
      endInteraction();
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const startRotation = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const pageRect = pageElement.getBoundingClientRect();
    let changed = false;

    const handleMove = (moveEvent: PointerEvent) => {
      const rotation = rotationFromPointer({
          pageRect,
          element,
          pointerClientX: moveEvent.clientX,
          pointerClientY: moveEvent.clientY,
          snap: moveEvent.shiftKey,
        });
      const nextRotation = constrainRotation(element, rotation, DEFAULT_SAFE_AREA);
      const hasChanged = Math.abs(nextRotation - element.rotation) > 0.5;
      if (!hasChanged && !changed) {
        return;
      }
      if (!changed) {
        recordHistory(documents);
        beginInteraction({ mode: "rotating", elementId: element.id, preview: {} });
        changed = true;
      }
      updatePreview({ rotation: nextRotation });
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      const next = useEditorStore.getState().interaction.preview;
      if (changed && next) {
        updateElement(element.id, next);
      }
      endInteraction();
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <div className="selection-box" data-locked={element.locked} style={style}>
      {element.locked && (
        <span className="selection-lock" aria-label="Elemento bloqueado">
          <Lock size={13} />
        </span>
      )}
      <RotationHandle onPointerDown={startRotation} disabled={disabled || element.type === "comment"} />
      {sizing.resizable && <ResizeHandles onPointerDown={startResize} disabled={!canResize} />}
    </div>
  );
}
