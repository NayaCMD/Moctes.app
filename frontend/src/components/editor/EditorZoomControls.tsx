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
  const zoomFromCurrentScale = zoomMode === "fit" ? scale : zoom;
  const zoomPercentage = Math.round(scale * 100);

  return (
    <div className="editor-zoom-controls" aria-label="Zoom do editor">
      <button
        type="button"
        aria-label="Diminuir zoom"
        data-tooltip="Diminuir zoom"
        onClick={() => onZoomChange(zoomFromCurrentScale - EDITOR_ZOOM_STEP)}
      >
        <Minus size={15} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="editor-zoom-value"
        aria-label={`Zoom atual ${zoomPercentage}%. Redefinir para 100%`}
        data-tooltip="Redefinir para 100%"
        onClick={onResetZoom}
      >
        {zoomPercentage}%
      </button>
      <button
        type="button"
        aria-label="Aumentar zoom"
        data-tooltip="Aumentar zoom"
        onClick={() => onZoomChange(zoomFromCurrentScale + EDITOR_ZOOM_STEP)}
      >
        <Plus size={15} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="editor-zoom-fit"
        aria-label="Ajustar à janela"
        data-active={zoomMode === "fit"}
        data-tooltip="Ajustar à janela"
        onClick={onFitToWindow}
      >
        <Maximize2 size={15} aria-hidden="true" />
        <span>Ajustar</span>
      </button>
    </div>
  );
}
