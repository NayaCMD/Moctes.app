import { Maximize2, Minus, Plus } from "lucide-react";
import { EDITOR_ZOOM_STEP } from "../../config/documentGeometry";
import type { ZoomMode } from "../../types/editor.types";

interface EditorZoomControlsProps {
  scale: number;
  zoom: number;
  zoomMode: ZoomMode;
  onZoomChange: (zoom: number) => void;
  onFitToWindow: () => void;
  onResetZoom: () => void;
}

export function EditorZoomControls({
  scale,
  zoom,
  zoomMode,
  onZoomChange,
  onFitToWindow,
  onResetZoom,
}: EditorZoomControlsProps) {
  return (
    <div className="editor-zoom-controls" aria-label="Zoom do editor">
      <button
        type="button"
        aria-label="Diminuir zoom"
        onClick={() => onZoomChange(zoom - EDITOR_ZOOM_STEP)}
      >
        <Minus size={13} />
      </button>
      <output aria-label="Zoom atual">{Math.round(scale * 100)}%</output>
      <button
        type="button"
        aria-label="Aumentar zoom"
        onClick={() => onZoomChange(zoom + EDITOR_ZOOM_STEP)}
      >
        <Plus size={13} />
      </button>
      <button
        type="button"
        aria-label="Ajustar à janela"
        data-active={zoomMode === "fit"}
        onClick={onFitToWindow}
      >
        <Maximize2 size={13} />
      </button>
      <button type="button" className="editor-zoom-reset" onClick={onResetZoom}>
        100%
      </button>
    </div>
  );
}
