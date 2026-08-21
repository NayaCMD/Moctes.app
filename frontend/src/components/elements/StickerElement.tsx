import type { PageElement } from "../../types/element.types";
import { useElementAssetPreview } from "../../hooks/useLibraryAssetPreview";
import { AssetMedia } from "../assets/AssetMedia";

interface StickerElementProps {
  element: PageElement;
}

export function StickerElement({ element }: StickerElementProps) {
  const content = element.content.kind === "sticker" ? element.content : null;
  const preview = useElementAssetPreview(content?.assetId, content?.src ?? "");

  if (element.content.kind !== "sticker") {
    return null;
  }
  return (
    <AssetMedia
      preview={preview}
      className="page-sticker-element"
      alt={element.content.alt}
      style={element.style.image}
    />
  );
}
