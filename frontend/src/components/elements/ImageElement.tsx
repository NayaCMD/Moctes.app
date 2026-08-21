import type { PageElement } from "../../types/element.types";
import { useElementAssetPreview } from "../../hooks/useLibraryAssetPreview";
import { AssetMedia } from "../assets/AssetMedia";

interface ImageElementProps {
  element: PageElement;
}

export function ImageElement({ element }: ImageElementProps) {
  const content = element.content.kind === "image" ? element.content : null;
  const preview = useElementAssetPreview(content?.assetId, content?.src ?? "");

  if (element.content.kind !== "image") {
    return null;
  }
  return (
    <AssetMedia
      preview={preview}
      className="page-image-element"
      alt={element.content.alt}
      style={element.style.image}
    />
  );
}
