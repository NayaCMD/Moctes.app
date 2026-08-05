import { useEditorStore } from "../../stores/useEditorStore";

interface DrawingPreviewOverlayProps {
  pageId: string;
}

export function DrawingPreviewOverlay({ pageId }: DrawingPreviewOverlayProps) {
  const preview = useEditorStore((state) => state.drawingPreview);

  if (!preview || preview.pageId !== pageId || preview.points.length < 2) {
    return null;
  }

  return (
    <svg className="drawing-preview-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={preview.points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none"
        stroke={preview.color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={preview.width}
        opacity={preview.opacity}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
