import type { PageElement } from "../../types/element.types";
import { useElementAssetPreview } from "../../hooks/useLibraryAssetPreview";

interface StickerElementProps {
  element: PageElement;
}

export function StickerElement({ element }: StickerElementProps) {
  const content = element.content.kind === "sticker" ? element.content : null;
  const src = useElementAssetPreview(content?.assetId, content?.src ?? "");

  if (element.content.kind !== "sticker") {
    return null;
  }
  if (!src) {
    return <span className="asset-missing">Asset indisponivel</span>;
  }

  return (
    <img
      className="page-sticker-element"
      src={src}
      alt={element.content.alt}
      style={element.style.image}
      draggable={false}
    />
  );
}
