import { useEffect, useRef, type RefObject } from "react";
import {
  MAX_EDITOR_ZOOM,
  MIN_EDITOR_ZOOM,
  type DocumentGeometry,
} from "../config/documentGeometry";

interface TouchDocumentGesturesOptions {
  geometry: DocumentGeometry;
  scale: number;
  onZoomCommit: (zoom: number) => void;
}

interface PointerPosition {
  x: number;
  y: number;
}

interface PanGesture {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
}

interface PinchGesture {
  distance: number;
  scale: number;
  documentX: number;
  documentY: number;
  latestScale: number;
  committed: boolean;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const distanceBetween = (first: PointerPosition, second: PointerPosition) =>
  Math.hypot(second.x - first.x, second.y - first.y);

const midpoint = (first: PointerPosition, second: PointerPosition) => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
});

function isTouchControl(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(
    "button, input, select, textarea, [contenteditable='true'], .resize-handle, .rotation-handle, .page-element-frame[data-selected='true']",
  ));
}

export function useTouchDocumentGestures({
  geometry,
  scale,
  onZoomCommit,
}: TouchDocumentGesturesOptions): RefObject<HTMLDivElement | null> {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const scaleRef = useRef(scale);
  const geometryRef = useRef(geometry);
  const zoomCommitRef = useRef(onZoomCommit);

  useEffect(() => {
    scaleRef.current = scale;
    geometryRef.current = geometry;
    zoomCommitRef.current = onZoomCommit;
  }, [geometry, onZoomCommit, scale]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const pointers = new Map<number, PointerPosition>();
    let pan: PanGesture | null = null;
    let pinch: PinchGesture | null = null;

    const readPinchPoints = () => [...pointers.values()].slice(0, 2);

    const beginPinch = () => {
      const [first, second] = readPinchPoints();
      const layer = stage.querySelector<HTMLElement>(".document-scale-layer");
      if (!first || !second || !layer) return;

      const center = midpoint(first, second);
      const layerRect = layer.getBoundingClientRect();
      const initialScale = scaleRef.current;
      pinch = {
        distance: Math.max(1, distanceBetween(first, second)),
        scale: initialScale,
        documentX: (center.x - layerRect.left) / initialScale,
        documentY: (center.y - layerRect.top) / initialScale,
        latestScale: initialScale,
        committed: false,
      };
      pan = null;
      stage.dataset.touchGesture = "pinch";
      window.dispatchEvent(new CustomEvent("moctes:pinchstart"));
    };

    const applyPinch = () => {
      const [first, second] = readPinchPoints();
      const viewport = stage.querySelector<HTMLElement>(".document-viewport");
      const layer = stage.querySelector<HTMLElement>(".document-scale-layer");
      if (!pinch || !first || !second || !viewport || !layer) return;

      const center = midpoint(first, second);
      const nextScale = clamp(
        pinch.scale * (distanceBetween(first, second) / pinch.distance),
        MIN_EDITOR_ZOOM,
        MAX_EDITOR_ZOOM,
      );
      const activeGeometry = geometryRef.current;

      viewport.style.width = `${activeGeometry.width * nextScale}px`;
      viewport.style.height = `${activeGeometry.height * nextScale}px`;
      layer.style.transform = `scale(${nextScale})`;

      const nextRect = layer.getBoundingClientRect();
      stage.scrollLeft += nextRect.left + pinch.documentX * nextScale - center.x;
      stage.scrollTop += nextRect.top + pinch.documentY * nextScale - center.y;
      pinch.latestScale = nextScale;
    };

    const commitPinch = () => {
      if (!pinch || pinch.committed) return;
      pinch.committed = true;
      zoomCommitRef.current(pinch.latestScale);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.size === 1 && !isTouchControl(event.target)) {
        pan = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          scrollLeft: stage.scrollLeft,
          scrollTop: stage.scrollTop,
        };
        stage.dataset.touchGesture = "pan-pending";
      }

      if (pointers.size === 2) {
        event.preventDefault();
        beginPinch();
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || !pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pinch && pointers.size >= 2) {
        event.preventDefault();
        applyPinch();
        return;
      }

      if (pan?.pointerId === event.pointerId) {
        const deltaX = event.clientX - pan.startX;
        const deltaY = event.clientY - pan.startY;
        if (Math.hypot(deltaX, deltaY) < 5 && stage.dataset.touchGesture !== "pan") return;
        event.preventDefault();
        stage.dataset.touchGesture = "pan";
        stage.scrollLeft = pan.scrollLeft - deltaX;
        stage.scrollTop = pan.scrollTop - deltaY;
      }
    };

    const finishPointer = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || !pointers.has(event.pointerId)) return;
      pointers.delete(event.pointerId);
      if (pinch) commitPinch();
      if (pointers.size === 0) {
        pan = null;
        pinch = null;
        delete stage.dataset.touchGesture;
      } else if (pinch) {
        stage.dataset.touchGesture = "pinch";
      }
    };

    stage.addEventListener("pointerdown", handlePointerDown, { capture: true });
    window.addEventListener("pointermove", handlePointerMove, { capture: true, passive: false });
    window.addEventListener("pointerup", finishPointer, { capture: true });
    window.addEventListener("pointercancel", finishPointer, { capture: true });

    return () => {
      stage.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", finishPointer, { capture: true });
      window.removeEventListener("pointercancel", finishPointer, { capture: true });
    };
  }, []);

  return stageRef;
}
