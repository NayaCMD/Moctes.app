import { useState } from "react";
import type { LibraryAsset } from "../../types/asset.types";
import type { ShapeAppearance } from "../../types/element.types";
import { AssetPickerPanel } from "./AssetPickerPanel";

const shapes: Array<{ shape: ShapeAppearance["shapeType"]; label: string }> = [
  { shape: "rectangle", label: "Retangulo" },
  { shape: "circle", label: "Circulo" },
  { shape: "triangle", label: "Triangulo" },
  { shape: "line", label: "Linha" },
  { shape: "arrow", label: "Seta" },
  { shape: "star", label: "Estrela" },
  { shape: "heart", label: "Coracao" },
];

const fillOptions = ["#dfe8ff", "#ffe3ef", "#fff1b8", "#dff4dc", "#f0e6ff", "#ffffff"];
const borderOptions = ["#8da3ed", "#d58aac", "#d5b65f", "#82b27b", "#a98fd8", "#8791a8"];
const borderWidths = [0, 1, 2, 4];

interface ShapeStickerPickerProps {
  stickers: LibraryAsset[];
  destinationLabel: string;
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  onFillColorChange: (value: string) => void;
  onBorderColorChange: (value: string) => void;
  onBorderWidthChange: (value: number) => void;
  onPickShape: (shape: ShapeAppearance["shapeType"]) => void;
  onPickSticker: (asset: LibraryAsset) => void;
  onImportShapeSvg?: () => void;
  onImportStickerSvg?: () => void;
}

export function ShapeStickerPicker({
  stickers,
  destinationLabel,
  fillColor,
  borderColor,
  borderWidth,
  onFillColorChange,
  onBorderColorChange,
  onBorderWidthChange,
  onPickShape,
  onPickSticker,
  onImportShapeSvg,
  onImportStickerSvg,
}: ShapeStickerPickerProps) {
  const [tab, setTab] = useState<"shapes" | "stickers">("shapes");

  return (
    <div className="shape-sticker-picker" aria-label="Escolher forma ou sticker">
      <div className="tool-tabs equal" role="tablist" aria-label="Tipo de item">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "shapes"}
          aria-controls="shape-picker-panel"
          data-active={tab === "shapes"}
          onClick={() => setTab("shapes")}
        >
          Formas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "stickers"}
          aria-controls="sticker-picker-panel"
          data-active={tab === "stickers"}
          onClick={() => setTab("stickers")}
        >
          Stickers
        </button>
      </div>
      {tab === "shapes" ? (
        <section id="shape-picker-panel" className="shape-picker-panel" role="tabpanel">
          <div className="tool-control-block">
            <h3>Forma</h3>
            {onImportShapeSvg && (
              <button type="button" className="asset-import-inline-button" onClick={onImportShapeSvg}>
                + Importar forma SVG
              </button>
            )}
            <div className="shape-grid">
              {shapes.map((item) => (
                <button
                  key={item.shape}
                  type="button"
                  className="shape-choice"
                  data-shape={item.shape}
                  aria-label={`Inserir ${item.label}`}
                  onClick={() => onPickShape(item.shape)}
                >
                  <span aria-hidden="true" />
                  <small>{item.label}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="tool-control-block">
            <h3>Preenchimento</h3>
            <ColorSwatches value={fillColor} options={fillOptions} onChange={onFillColorChange} label="preenchimento" />
          </div>
          <div className="tool-control-block">
            <h3>Borda</h3>
            <ColorSwatches value={borderColor} options={borderOptions} onChange={onBorderColorChange} label="borda" />
          </div>
          <div className="tool-control-block">
            <h3>Espessura</h3>
            <div className="segmented-values" aria-label="Espessura da borda">
              {borderWidths.map((width) => (
                <button
                  key={width}
                  type="button"
                  data-active={borderWidth === width}
                  aria-pressed={borderWidth === width}
                  onClick={() => onBorderWidthChange(width)}
                >
                  {width}
                </button>
              ))}
            </div>
          </div>
          <p className="tool-target-note">{destinationLabel}</p>
        </section>
      ) : (
        <AssetPickerPanel
          title="Stickers"
          assets={stickers}
          emptyMessage="Nenhum sticker nesta pasta."
          destinationLabel={destinationLabel}
          onPick={onPickSticker}
          onImport={onImportStickerSvg}
          importLabel="+ Importar sticker SVG"
        />
      )}
    </div>
  );
}

function ColorSwatches({
  value,
  options,
  label,
  onChange,
}: {
  value: string;
  options: string[];
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="color-swatch-row" aria-label={`Escolher ${label}`}>
      {options.map((color) => (
        <button
          key={color}
          type="button"
          className="mini-color-swatch"
          data-active={value.toLowerCase() === color.toLowerCase()}
          aria-label={`${label} ${color}`}
          aria-pressed={value.toLowerCase() === color.toLowerCase()}
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}
