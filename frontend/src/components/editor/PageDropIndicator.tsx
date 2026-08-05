import type { CSSProperties } from "react";
import { useEditorStore } from "../../stores/useEditorStore";
import { DEFAULT_SAFE_AREA, pointerToPagePercent } from "../../utils/coordinates.utils";

interface PageDropIndicatorProps {
  pageId: string;
  pageElement: HTMLElement | null;
}

export function PageDropIndicator({ pageId, pageElement }: PageDropIndicatorProps) {
  const assetDrag = useEditorStore((state) => state.assetDrag);
  const transferPreview = useEditorStore((state) => state.transferPreview);

  if (
    !pageElement ||
    !(
      (assetDrag.status === "dragging" && assetDrag.targetPageId === pageId) ||
      transferPreview?.targetPageId === pageId
    )
  ) {
    return null;
  }

  const rect = pageElement.getBoundingClientRect();
  const pointer = transferPreview?.targetPageId === pageId
    ? { x: transferPreview.x, y: transferPreview.y }
    : pointerToPagePercent(
        { clientX: assetDrag.pointerX, clientY: assetDrag.pointerY },
        rect,
      );
  const markerStyle: CSSProperties = {
    left: `${pointer.x}%`,
    top: `${pointer.y}%`,
  };
  const safeAreaStyle: CSSProperties = {
    inset: `${DEFAULT_SAFE_AREA.top}% ${DEFAULT_SAFE_AREA.right}% ${DEFAULT_SAFE_AREA.bottom}% ${DEFAULT_SAFE_AREA.left}%`,
  };

  return (
    <div
      className="page-drop-layer"
      data-valid={transferPreview?.targetPageId === pageId ? transferPreview.validTarget : assetDrag.validDrop}
      aria-hidden="true"
    >
      <span className="page-drop-safe-area" style={safeAreaStyle} />
      <span className="page-drop-marker" style={markerStyle} />
    </div>
  );
}
