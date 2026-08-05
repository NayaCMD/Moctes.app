import { useAssetDrag } from "../../hooks/useAssetDrag";
import type { SidebarAsset } from "../../types/document.types";

interface AssetThumbnailProps {
  asset: SidebarAsset;
  selected: boolean;
  previewSrc?: string | null;
  onSelect: (assetId: string) => void;
  onAdd?: (asset: SidebarAsset) => void;
  onAdded?: (assetId: string) => void;
  onDelete?: (asset: SidebarAsset) => void;
  showActions?: boolean;
}

export function AssetThumbnail({
  asset,
  selected,
  previewSrc,
  onSelect,
  onAdd,
  onAdded,
  onDelete,
  showActions = true,
}: AssetThumbnailProps) {
  const assetDrag = useAssetDrag({ asset, previewSrc, onSelect, onAdded });

  return (
    <div className="asset-thumbnail-wrap">
      <button
        type="button"
        className="asset-thumbnail"
        data-active={selected}
        aria-label={`Selecionar ${asset.label}`}
        title={`${asset.category}: Enter ou botao Adicionar para inserir; arraste para soltar na pagina.`}
        aria-pressed={selected}
        onPointerDown={assetDrag.onPointerDown}
        onClick={(event) => {
          if (assetDrag.shouldSuppressClick()) {
            event.preventDefault();
            return;
          }
          onSelect(asset.id);
        }}
        onDoubleClick={(event) => {
          if (assetDrag.shouldSuppressClick()) {
            event.preventDefault();
            return;
          }
          onAdd?.(asset);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onAdd?.(asset);
          }
        }}
      >
        {previewSrc ? (
          <img src={previewSrc} alt="" loading="lazy" />
        ) : (
          <span className="asset-thumbnail-missing">Asset indisponivel</span>
        )}
      </button>
      {showActions && (
        <div className="asset-actions">
          <button
            type="button"
            className="asset-add-button"
            aria-label={`Adicionar ${asset.label} a pagina`}
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
    </div>
  );
}
