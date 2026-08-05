import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useLibraryAssetPreview } from "../../hooks/useLibraryAssetPreview";
import { useAssetLibraryStore } from "../../stores/useAssetLibraryStore";
import type { LibraryAsset } from "../../types/asset.types";

interface AssetPickerPanelProps {
  title: string;
  assets: LibraryAsset[];
  emptyMessage: string;
  destinationLabel: string;
  onPick: (asset: LibraryAsset) => void;
  onImport?: () => void;
  importLabel?: string;
  variant?: "image" | "tape" | "default";
}

export function AssetPickerPanel({
  title,
  assets,
  emptyMessage,
  destinationLabel,
  onPick,
  onImport,
  importLabel: importLabelOverride,
  variant = "default",
}: AssetPickerPanelProps) {
  const folders = useAssetLibraryStore((state) => state.folders);
  const [query, setQuery] = useState("");
  const [folderId, setFolderId] = useState("all");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const visibleAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesQuery = normalized ? asset.name.toLowerCase().includes(normalized) : true;
      const matchesFolder = folderId === "all" ? true : asset.folderId === folderId;
      return matchesQuery && matchesFolder;
    });
  }, [assets, folderId, query]);
  const selectedAsset = visibleAssets.find((asset) => asset.id === selectedAssetId) ?? null;

  const importLabel =
    importLabelOverride ??
    (variant === "image" ? "Importar imagem" : variant === "tape" ? "Importar tape" : "Importar asset");

  return (
    <div className="tool-asset-panel" aria-label={title}>
      <div className="tool-picker-toolbar">
        <label className="tool-picker-search">
          Buscar
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Buscar ${title.toLowerCase()}...`}
          />
        </label>
        <label className="tool-picker-folder">
          Pasta
          <select value={folderId} onChange={(event) => setFolderId(event.target.value)}>
            <option value="all">Todas</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {onImport && visibleAssets.length > 0 && (
        <button type="button" className="tool-import-button" onClick={onImport}>
          <Plus size={15} />
          {importLabel}
        </button>
      )}

      {visibleAssets.length === 0 ? (
        <div className="tool-empty-state">
          <p>{emptyMessage}</p>
          {onImport && (
            <button type="button" className="tool-import-button" onClick={onImport}>
              <Plus size={15} />
              {importLabel}
            </button>
          )}
        </div>
      ) : (
        <div className="tool-asset-grid" data-variant={variant}>
          {visibleAssets.map((asset) => (
            <ToolAssetButton
              key={asset.id}
              asset={asset}
              selected={selectedAssetId === asset.id}
              onSelect={() => setSelectedAssetId(asset.id)}
              onPick={onPick}
              variant={variant}
            />
          ))}
        </div>
      )}

      <div className="tool-picker-footer">
        <span>{destinationLabel}</span>
        <button type="button" disabled={!selectedAsset} onClick={() => selectedAsset && onPick(selectedAsset)}>
          Adicionar a pagina
        </button>
      </div>
    </div>
  );
}

function ToolAssetButton({
  asset,
  selected,
  onSelect,
  onPick,
  variant,
}: {
  asset: LibraryAsset;
  selected: boolean;
  onSelect: () => void;
  onPick: (asset: LibraryAsset) => void;
  variant: "image" | "tape" | "default";
}) {
  const previewSrc = useLibraryAssetPreview(asset);

  return (
    <button
      type="button"
      data-variant={variant}
      data-selected={selected}
      aria-label={`Selecionar ${asset.name}`}
      aria-pressed={selected}
      onClick={onSelect}
      onDoubleClick={() => onPick(asset)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onPick(asset);
        }
      }}
    >
      {previewSrc ? <img src={previewSrc} alt="" /> : <span>Indisponivel</span>}
    </button>
  );
}
