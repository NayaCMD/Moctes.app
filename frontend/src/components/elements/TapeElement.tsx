import type { CSSProperties } from "react";
import type { PageElement } from "../../types/element.types";
import { useElementAssetPreview } from "../../hooks/useLibraryAssetPreview";
import {
  DEFAULT_TAPE_EDGE_STYLE,
  DEFAULT_TAPE_RENDER_MODE,
} from "../../utils/tape.utils";
import { AssetPlaceholder } from "../assets/AssetPlaceholder";

interface TapeElementProps {
  element: PageElement;
}

export function TapeElement({ element }: TapeElementProps) {
  const content = element.content.kind === "tape" ? element.content : null;
  const preview = useElementAssetPreview(content?.assetId, content?.src ?? "");

  if (element.content.kind !== "tape") {
    return null;
  }

  const { opacity, borderRadius, boxShadow } = element.style.image ?? {};

  if (preview.availability !== "ready" || !preview.src) {
    return (
      <AssetPlaceholder
        availability={
          preview.availability === "ready" ? "error" : preview.availability
        }
        processingError={preview.processingError}
        variant="editor"
        onRetry={preview.canRetry ? preview.retry : undefined}
        style={{ opacity, borderRadius, boxShadow }}
      />
    );
  }

  const style: CSSProperties = {
    opacity,
    borderRadius,
    boxShadow,
    backgroundImage: `url("${preview.src}")`,
  };

  return (
    <div
      className="page-tape-element"
      role="img"
      aria-label={element.content.alt}
      data-render-mode={element.content.renderMode ?? DEFAULT_TAPE_RENDER_MODE}
      data-edge={element.content.edgeStyle ?? DEFAULT_TAPE_EDGE_STYLE}
      data-cache={preview.fromCache ? "local" : "network"}
      style={style}
    >
      <img
        className="page-tape-source-probe"
        src={preview.src}
        alt=""
        aria-hidden="true"
        draggable={false}
        onError={preview.onLoadError}
      />
    </div>
  );
}
