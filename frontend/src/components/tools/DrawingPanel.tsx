import type { CSSProperties } from "react";
import type { DrawingToolSettings, RulerState } from "../../types/editor.types";

interface DrawingPanelProps {
  activeTab: "pen" | "ruler";
  settings: DrawingToolSettings;
  ruler: RulerState;
  isDrawing: boolean;
  onActiveTabChange: (tab: "pen" | "ruler") => void;
  onSettingsChange: (settings: Partial<DrawingToolSettings>) => void;
  onRulerChange: (state: Partial<RulerState>) => void;
  onDrawMode: () => void;
  onRulerMode: () => void;
}

export function DrawingPanel({
  activeTab,
  settings,
  ruler,
  isDrawing,
  onActiveTabChange,
  onSettingsChange,
  onRulerChange,
  onDrawMode,
  onRulerMode,
}: DrawingPanelProps) {
  const previewStyle = {
    "--stroke-preview-color": settings.color,
    "--stroke-preview-width": `${settings.strokeWidth}px`,
    "--stroke-preview-opacity": settings.opacity,
  } as CSSProperties;

  return (
    <div className="drawing-panel" aria-label="Caneta e régua">
      <div className="tool-tabs equal" role="tablist" aria-label="Ferramenta">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "pen"}
          aria-controls="drawing-pen-panel"
          data-active={activeTab === "pen"}
          onClick={() => {
            onActiveTabChange("pen");
            onDrawMode();
          }}
        >
          Caneta
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "ruler"}
          aria-controls="drawing-ruler-panel"
          data-active={activeTab === "ruler"}
          onClick={() => {
            onActiveTabChange("ruler");
            onRulerMode();
          }}
        >
          Regua
        </button>
      </div>

      {activeTab === "pen" ? (
        <section id="drawing-pen-panel" className="drawing-tool-section" role="tabpanel">
          <div className="tool-control-block">
            <h3>Tipo</h3>
            <div className="drawing-mode-row" aria-label="Tipo de desenho">
              <button
                type="button"
                data-active={settings.mode === "pen"}
                onClick={() => onSettingsChange({ mode: "pen", opacity: 0.9 })}
              >
                Caneta
              </button>
              <button
                type="button"
                data-active={settings.mode === "highlighter"}
                onClick={() => onSettingsChange({ mode: "highlighter", opacity: 0.38 })}
              >
                Marca-texto
              </button>
            </div>
          </div>
          <label>
            Cor
            <input type="color" value={settings.color} onChange={(event) => onSettingsChange({ color: event.target.value })} />
          </label>
          <label>
            Espessura
            <input
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={settings.strokeWidth}
              onChange={(event) => onSettingsChange({ strokeWidth: Number(event.target.value) })}
            />
          </label>
          <label>
            Opacidade
            <input
              type="range"
              min={0.15}
              max={1}
              step={0.05}
              value={settings.opacity}
              onChange={(event) => onSettingsChange({ opacity: Number(event.target.value) })}
            />
          </label>
          <div className="stroke-preview" style={previewStyle} aria-label="Previa do traco">
            <span />
          </div>
          <p className="drawing-active-note" data-drawing={isDrawing}>
            {isDrawing
              ? "Desenhando..."
              : settings.mode === "highlighter"
                ? "Marca-texto ativo"
                : "Caneta ativa"}
          </p>
        </section>
      ) : (
        <section id="drawing-ruler-panel" className="drawing-tool-section" role="tabpanel">
          <label className="drawing-checkbox">
            <input
              type="checkbox"
              checked={ruler.visible}
              onChange={(event) => onRulerChange({ visible: event.target.checked })}
            />
            Mostrar régua
          </label>
          <label>
            Angulo: {ruler.rotation} graus
            <input
              type="range"
              min={-90}
              max={90}
              value={ruler.rotation}
              onChange={(event) => onRulerChange({ rotation: Number(event.target.value) })}
            />
          </label>
          <label>
            Comprimento
            <input
              type="range"
              min={30}
              max={90}
              value={ruler.length}
              onChange={(event) => onRulerChange({ length: Number(event.target.value) })}
            />
          </label>
          <div className="drawing-mode-row">
            <button type="button" onClick={() => onRulerChange({ visible: true, x: 50, y: 50 })}>
              Centralizar
            </button>
            <button type="button" onClick={() => onRulerChange({ visible: true, x: 42, y: 52, rotation: 0, length: 64 })}>
              Redefinir
            </button>
          </div>
          <p className="tool-panel-note">Arraste a régua para mover e use a alça para girar.</p>
        </section>
      )}
    </div>
  );
}
