import { type FormEvent, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import type {
  NotebookDividerUpdate,
  NotebookMaterial,
  NotebookSection,
} from "../../types/notebook.types";
import {
  clampNotebookTabPosition,
  NOTEBOOK_TAB_MAX_POSITION,
  NOTEBOOK_TAB_MIN_POSITION,
} from "../../utils/notebookTabs.utils";

interface NotebookDividerSettingsProps {
  open: boolean;
  section: NotebookSection | null;
  onSave: (updates: NotebookDividerUpdate) => void;
  onCancel: () => void;
}

export function NotebookDividerSettings({
  open,
  section,
  onSave,
  onCancel,
}: NotebookDividerSettingsProps) {
  const titleId = useId();
  const descriptionId = useId();
  const [color, setColor] = useState(section?.divider.color ?? "#d9f4f7");
  const [tabColor, setTabColor] = useState(section?.divider.tabColor ?? "#bde4eb");
  const [textColor, setTextColor] = useState(section?.divider.textColor ?? "#26324a");
  const [tabPosition, setTabPosition] = useState(
    clampNotebookTabPosition(section?.divider.tabPosition ?? 0),
  );
  const [material, setMaterial] = useState<NotebookMaterial>(
    section?.divider.material ?? "smooth",
  );
  const [textureIntensity, setTextureIntensity] = useState(
    section?.divider.textureIntensity ?? 12,
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open]);

  if (!open || !section) {
    return null;
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSave({
      color,
      tabColor,
      textColor,
      tabPosition: clampNotebookTabPosition(tabPosition),
      material,
      textureIntensity,
    });
  };

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form
        className="notebook-divider-settings confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 id={titleId}>Personalizar divisória</h2>
        <p id={descriptionId}>Ajuste as cores e a posição visual da aba de {section.title}.</p>
        <label className="notebook-form-field">
          <span>Cor da divisória</span>
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        </label>
        <label className="notebook-form-field">
          <span>Cor da aba</span>
          <input
            type="color"
            value={tabColor}
            onChange={(event) => setTabColor(event.target.value)}
          />
        </label>
        <label className="notebook-form-field">
          <span>Cor do texto</span>
          <input
            type="color"
            value={textColor}
            onChange={(event) => setTextColor(event.target.value)}
          />
        </label>
        <label className="notebook-form-field">
          <span>Textura</span>
          <select
            value={material}
            onChange={(event) => setMaterial(event.target.value as NotebookMaterial)}
          >
            <option value="smooth">Lisa</option>
            <option value="linen">Tecido</option>
            <option value="speckled">Granulada</option>
          </select>
        </label>
        <label className="notebook-form-field">
          <span>Intensidade da textura</span>
          <input
            type="range"
            min="0"
            max="40"
            value={textureIntensity}
            onChange={(event) => setTextureIntensity(Number(event.target.value))}
          />
          <output>{textureIntensity}%</output>
        </label>
        <label className="notebook-form-field">
          <span>Posição da aba</span>
          <input
            type="range"
            min={NOTEBOOK_TAB_MIN_POSITION}
            max={NOTEBOOK_TAB_MAX_POSITION}
            value={tabPosition}
            onChange={(event) => setTabPosition(Number(event.target.value))}
          />
          <output>{tabPosition}%</output>
        </label>
        <footer>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" data-primary="true">
            Salvar
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
