import type { PageElement } from "../../types/element.types";
import { useElementAssetPreview } from "../../hooks/useLibraryAssetPreview";

interface TapeElementProps {
  element: PageElement;
}

export function TapeElement({ element }: TapeElementProps) {
  const content = element.content.kind === "tape" ? element.content : null;
  const src = useElementAssetPreview(content?.assetId, content?.src ?? "");

  if (element.content.kind !== "tape") {
    return null;
  }
  if (!src) {
    return <span className="asset-missing">Asset indisponivel</span>;
  }

  return (
    <img
      className="page-tape-element"
      src={src}
      alt={element.content.alt}
      style={element.style.image}
      draggable={false}
    />
  );
}
