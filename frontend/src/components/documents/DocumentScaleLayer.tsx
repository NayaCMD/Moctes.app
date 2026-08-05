import type { ReactNode } from "react";
import type { DocumentGeometry } from "../../config/documentGeometry";

interface DocumentScaleLayerProps {
  children: ReactNode;
  geometry: DocumentGeometry;
  renderedWidth: number;
  renderedHeight: number;
  scale: number;
  requiresHorizontalPan: boolean;
  requiresVerticalPan: boolean;
}

export function DocumentScaleLayer({
  children,
  geometry,
  renderedWidth,
  renderedHeight,
  scale,
  requiresHorizontalPan,
  requiresVerticalPan,
}: DocumentScaleLayerProps) {
  return (
    <div
      className="document-viewport"
      data-pan-x={requiresHorizontalPan}
      data-pan-y={requiresVerticalPan}
      style={{
        width: renderedWidth,
        height: renderedHeight,
      }}
    >
      <div
        className="document-scale-layer"
        style={{
          width: geometry.width,
          height: geometry.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

