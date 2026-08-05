import { useLibraryAssetPreview } from "../../hooks/useLibraryAssetPreview";
import type { LibraryAsset } from "../../types/asset.types";
import type { SidebarAsset } from "../../types/document.types";
import { libraryAssetToSidebarAsset } from "../../utils/assetLibrary.utils";
import { AssetThumbnail } from "./AssetThumbnail";

interface AssetSectionProps {
  title: string;
  assets: LibraryAsset[];
  selectedAssetId: string | null;
  onSelect: (assetId: string) => void;
  onAdd?: (asset: SidebarAsset) => void;
  onAdded?: (assetId: string) => void;
  onDelete?: (asset: LibraryAsset) => void;
  showActions?: boolean;
}

export function AssetSection({
  title,
  assets,
  selectedAssetId,
  onSelect,
  onAdd,
  onAdded,
  onDelete,
  showActions = true,
}: AssetSectionProps) {
  return (
    <section className="asset-section" aria-labelledby={`asset-section-${title}`}>
      <h2 id={`asset-section-${title}`}>{title}</h2>

      <div className="asset-grid">
        {assets.map((asset) => (
          <LibraryAssetThumbnail
            key={asset.id}
            asset={asset}
            selected={selectedAssetId === asset.id}
            onSelect={onSelect}
            onAdd={onAdd}
            onAdded={onAdded}
            onDelete={onDelete}
            showActions={showActions}
          />
        ))}
      </div>
    </section>
  );
}

function LibraryAssetThumbnail({
  asset,
  selected,
  onSelect,
  onAdd,
  onAdded,
  onDelete,
  showActions,
}: {
  asset: LibraryAsset;
  selected: boolean;
  onSelect: (assetId: string) => void;
  onAdd?: (asset: SidebarAsset) => void;
  onAdded?: (assetId: string) => void;
  onDelete?: (asset: LibraryAsset) => void;
  showActions: boolean;
}) {
  const previewSrc = useLibraryAssetPreview(asset);

  return (
    <AssetThumbnail
      asset={libraryAssetToSidebarAsset(asset)}
      selected={selected}
      previewSrc={previewSrc}
      onSelect={onSelect}
      onAdd={onAdd}
      onAdded={onAdded}
      onDelete={onDelete ? () => onDelete(asset) : undefined}
      showActions={showActions}
    />
  );
}
