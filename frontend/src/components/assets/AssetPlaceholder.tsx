import {
  CloudOff,
  FileQuestion,
  Image,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { AssetAvailability } from "../../types/asset.types";
import { assetAvailabilityCopy } from "../../utils/assetAvailability.utils";

interface AssetPlaceholderProps {
  availability: Exclude<AssetAvailability, "ready">;
  processingError?: { code: string; message: string };
  variant?: "editor" | "thumbnail" | "picker";
  onRetry?: () => void;
  style?: CSSProperties;
}

export function AssetPlaceholder({
  availability,
  processingError,
  variant = "editor",
  onRetry,
  style,
}: AssetPlaceholderProps) {
  const copy = assetAvailabilityCopy(availability, processingError);
  const busy = availability === "loading" || availability === "processing";

  return (
    <span
      className="asset-placeholder"
      data-availability={availability}
      data-tone={copy.tone}
      data-variant={variant}
      role={
        busy
          ? "status"
          : ["error", "rejected", "quarantined"].includes(availability)
            ? "alert"
            : "group"
      }
      aria-label={`${copy.title}${copy.detail ? `. ${copy.detail}` : ""}`}
      aria-live={busy ? "polite" : undefined}
      style={style}
    >
      <span className="asset-placeholder-icon" aria-hidden="true">
        {availabilityIcon(availability, variant === "editor" ? 22 : 17)}
      </span>
      <span className="asset-placeholder-copy">
        <strong>{copy.title}</strong>
        {copy.detail && <small>{copy.detail}</small>}
      </span>
      {onRetry && (
        <button
          type="button"
          className="asset-placeholder-retry"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRetry();
          }}
        >
          <RefreshCw size={13} aria-hidden="true" />
          Tentar novamente
        </button>
      )}
    </span>
  );
}

function availabilityIcon(
  availability: Exclude<AssetAvailability, "ready">,
  size: number,
) {
  switch (availability) {
    case "loading":
    case "processing":
      return <LoaderCircle size={size} />;
    case "pending":
      return <Image size={size} />;
    case "offline":
      return <CloudOff size={size} />;
    case "quarantined":
    case "rejected":
      return <ShieldAlert size={size} />;
    case "error":
      return <TriangleAlert size={size} />;
    case "not-found":
      return <FileQuestion size={size} />;
  }
}
