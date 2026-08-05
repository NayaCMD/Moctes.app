import { useEditorStore } from "../../stores/useEditorStore";

export function AssetDragPreview() {
  const assetDrag = useEditorStore((state) => state.assetDrag);

  if (assetDrag.status !== "dragging" || !assetDrag.previewSrc) {
    return null;
  }

  return (
    <div
      className="asset-drag-preview"
      data-valid={assetDrag.validDrop}
      style={{
        left: assetDrag.pointerX,
        top: assetDrag.pointerY,
      }}
      aria-hidden="true"
    >
      <img src={assetDrag.previewSrc} alt={assetDrag.previewAlt ?? ""} />
    </div>
  );
}
