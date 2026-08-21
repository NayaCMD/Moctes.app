import { useAssetDrag } from "../../hooks/useAssetDrag";
import type { AssetPreviewResult } from "../../hooks/useLibraryAssetPreview";
import type { SidebarAsset } from "../../types/document.types";
import { assetAvailabilityCopy } from "../../utils/assetAvailability.utils";
import { AssetMedia } from "../assets/AssetMedia";

interface AssetThumbnailProps {
  asset: SidebarAsset;
  selected: boolean;
  preview: AssetPreviewResult;
  onSelect: (assetId: string) => void;
  onAdd?: (asset: SidebarAsset) => void;
  onAdded?: (assetId: string) => void;
  onDelete?: (asset: SidebarAsset) => void;
  showActions?: boolean;
}

export function AssetThumbnail({
  asset,
  selected,
  preview,
  onSelect,
  onAdd,
  onAdded,
  onDelete,
  showActions = true,
}: AssetThumbnailProps) {
  const assetDrag = useAssetDrag({
    asset,
    previewSrc: preview.src,
    onSelect,
    onAdded,
  });
  const ready = preview.availability === "ready" && Boolean(preview.src);
  const lifecycle =
    preview.availability === "ready"
      ? null
      : assetAvailabilityCopy(
          preview.availability,
          preview.processingError,
        );

  return (
    <div className="asset-thumbnail-wrap">
      <button
        type="button"
        className="asset-thumbnail"
        data-status={preview.availability}
        data-active={selected}
        aria-label={`Selecionar ${asset.label}`}
        title={
          ready
            ? `${asset.category}: Enter ou botão Adicionar para inserir; arraste para soltar na página.`
            : lifecycle
              ? `${lifecycle.title}${lifecycle.detail ? `. ${lifecycle.detail}` : ""}`
              : undefined
        }
        aria-pressed={selected}
        aria-disabled={!ready}
        onPointerDown={ready && onAdd ? assetDrag.onPointerDown : undefined}
        onClick={(event) => {
          if (assetDrag.shouldSuppressClick()) {
            event.preventDefault();
            return;
          }
          onSelect(asset.id);
        }}
        onDoubleClick={(event) => {
          if (!ready) {
            return;
          }
          if (assetDrag.shouldSuppressClick()) {
            event.preventDefault();
            return;
          }
          onAdd?.(asset);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (ready) {
              onAdd?.(asset);
            }
          }
        }}
      >
        <AssetMedia
          preview={preview}
          alt=""
          loading="lazy"
          variant="thumbnail"
          showRetry={false}
        />
      </button>
      {preview.canRetry && (
        <div className="asset-lifecycle-row">
          <button
            type="button"
            className="asset-inline-retry"
            onClick={preview.retry}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {showActions && (
        <div className="asset-actions">
          <button
            type="button"
            className="asset-add-button"
            aria-label={`Adicionar ${asset.label} à página`}
            disabled={!ready}
            onClick={() => onAdd?.(asset)}
          >
            Adicionar
          </button>
          {onDelete && (
            <button
              type="button"
              className="asset-delete-button"
              aria-label={`Excluir ${asset.label}`}
              onClick={() => onDelete(asset)}
            >
              Excluir
            </button>
          )}
        </div>
      )}
      {!showActions && selected && onAdd && (
        <button
          type="button"
          className="asset-quick-add-button"
          disabled={!ready}
          onClick={() => onAdd(asset)}
        >
          Adicionar à página
        </button>
      )}
    </div>
  );
}
