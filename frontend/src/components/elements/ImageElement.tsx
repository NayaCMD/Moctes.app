import type { PageElement } from "../../types/element.types";
import { useElementAssetPreview } from "../../hooks/useLibraryAssetPreview";

interface ImageElementProps {
  element: PageElement;
}

export function ImageElement({ element }: ImageElementProps) {
  const content = element.content.kind === "image" ? element.content : null;
  const src = useElementAssetPreview(content?.assetId, content?.src ?? "");

  if (element.content.kind !== "image") {
    return null;
  }
  if (!src) {
    return <span className="asset-missing">Asset indisponivel</span>;
  }

  return (
    <img
      className="page-image-element"
      src={src}
      alt={element.content.alt}
      style={element.style.image}
      draggable={false}
    />
  );
}
