import { useEditorStore } from "../../stores/useEditorStore";

export function AssetDragPreview() {
  const assetDrag = useEditorStore((state) => state.assetDrag);

  if (
    assetDrag.status !== "dragging" ||
    (!assetDrag.previewSrc && !assetDrag.previewText)
  ) {
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
      {assetDrag.previewSrc ? (
        <img src={assetDrag.previewSrc} alt={assetDrag.previewAlt ?? ""} />
      ) : (
        <span className="asset-drag-preview-emoji">{assetDrag.previewText}</span>
      )}
    </div>
  );
}
