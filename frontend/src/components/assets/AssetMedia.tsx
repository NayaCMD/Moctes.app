import type { CSSProperties } from "react";
import type { AssetPreviewResult } from "../../hooks/useLibraryAssetPreview";
import { AssetPlaceholder } from "./AssetPlaceholder";

interface AssetMediaProps {
  preview: AssetPreviewResult;
  alt: string;
  className?: string;
  style?: CSSProperties;
  loading?: "eager" | "lazy";
  variant?: "editor" | "thumbnail" | "picker";
  showRetry?: boolean;
}

export function AssetMedia({
  preview,
  alt,
  className,
  style,
  loading,
  variant = "editor",
  showRetry = true,
}: AssetMediaProps) {
  if (preview.availability === "ready" && preview.src) {
    return (
      <img
        className={className}
        src={preview.src}
        alt={alt}
        style={style}
        loading={loading}
        draggable={false}
        data-cache={preview.fromCache ? "local" : "network"}
        onError={preview.onLoadError}
      />
    );
  }

  return (
    <AssetPlaceholder
      availability={
        preview.availability === "ready" ? "error" : preview.availability
      }
      processingError={preview.processingError}
      variant={variant}
      onRetry={showRetry && preview.canRetry ? preview.retry : undefined}
      style={style}
    />
  );
}
