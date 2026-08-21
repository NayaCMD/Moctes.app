import { useState, type CSSProperties } from "react";
import { BookmarkPlus, Check, FileText, Layers3, Trash2 } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type { NotebookMaterial } from "../../types/notebook.types";
import type { PaperAppearance, PaperTexture } from "../../types/page.types";
import type { PaperType } from "../../types/theme.types";
import { getEditableActivePage } from "../../utils/document.utils";
import {
  BUILT_IN_PAPER_PRESETS,
  getDefaultPatternSize,
  getPageAppearance,
  normalizePaperAppearance,
} from "../../utils/paperAppearance.utils";
import { ColorControl, PropertySection, SliderControl } from "./PropertyControls";

const patterns: Array<{ value: PaperType; label: string }> = [
  { value: "blank", label: "Branca" },
  { value: "lined", label: "Pautada" },
  { value: "grid", label: "Quadriculada" },
  { value: "dotted", label: "Pontilhada" },
];

const textures: Array<{ value: PaperTexture; label: string }> = [
  { value: "none", label: "Sem textura" },
  { value: "grain", label: "Granulada" },
  { value: "fiber", label: "Fibras" },
  { value: "recycled", label: "Reciclada" },
];

type AppearanceScope = "page" | "document";

export function PaperSettings() {
  const [scope, setScope] = useState<AppearanceScope>("page");
  const [linkedMargins, setLinkedMargins] = useState(true);
  const [templateName, setTemplateName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const setPaperType = useAppStore((state) => state.setPaperType);
  const setPaperColor = useAppStore((state) => state.setPaperColor);
  const documents = useDocumentStore((state) => state.documents);
  const activeDocumentId = useDocumentStore((state) => state.activeDocumentId);
  const updatePage = useDocumentStore((state) => state.updatePage);
  const updateDocument = useDocumentStore((state) => state.updateDocument);
  const updateNotebookDivider = useDocumentStore((state) => state.updateNotebookDivider);
  const notebookTransition = useEditorStore((state) => state.notebookTransition);
  const notebookBook = useEditorStore((state) => state.notebookBook);
  const activeDocument = documents.find((document) => document.id === activeDocumentId);
  const editableActivePage = activeDocument
    ? getEditableActivePage(activeDocument, { notebookBook, notebookTransition })
    : undefined;
  const activePage = editableActivePage ?? activeDocument?.pages.find(
    (page) => page.id === activeDocument.activePageId,
  );
  const appearance = activePage ? getPageAppearance(activePage) : null;
  const activeSection = activeDocument?.sections?.find(
    (section) =>
      section.id === activePage?.sectionId ||
      section.divider.id === activeDocument.activeSurfaceId,
  );

  if (!activeDocument || !activePage || !appearance) {
    return (
      <div className="paper-settings">
        <PropertySection title="Papel" description="Abra uma página para editar sua aparência">
          <p className="paper-settings-empty">A capa ou divisória está ativa. Navegue até uma página para escolher papel, margens e templates.</p>
        </PropertySection>
      </div>
    );
  }

  const applyAppearance = (next: PaperAppearance) => {
    const normalized = normalizePaperAppearance(next);
    setPaperType(normalized.paperType);
    setPaperColor(normalized.paperColor);
    if (scope === "document") {
      const updatedAt = new Date().toISOString();
      updateDocument(activeDocument.id, {
        defaultPaperAppearance: normalized,
        pages: activeDocument.pages.map((page) => ({
          ...page,
          ...normalized,
          margins: { ...normalized.margins },
          updatedAt,
        })),
      });
      return;
    }
    updatePage(activePage.id, normalized);
  };

  const updateAppearance = (updates: Partial<PaperAppearance>) => {
    applyAppearance(normalizePaperAppearance({
      ...appearance,
      ...updates,
      margins: updates.margins ?? appearance.margins,
    }));
  };

  const updateMargin = (side: "top" | "right" | "bottom" | "left", value: number) => {
    const margins = linkedMargins
      ? { top: value, right: value, bottom: value, left: value, visible: true }
      : { ...appearance.margins, [side]: value, visible: true };
    updateAppearance({ margins });
  };

  const saveTemplate = () => {
    const name = templateName.trim();
    if (!name) {
      setFeedback("Dê um nome ao template antes de salvar.");
      return;
    }
    updateDocument(activeDocument.id, {
      paperTemplates: [
        ...(activeDocument.paperTemplates ?? []),
        {
          id: `paper-template-${crypto.randomUUID()}`,
          name: name.slice(0, 48),
          appearance,
          createdAt: new Date().toISOString(),
        },
      ].slice(-24),
    });
    setTemplateName("");
    setFeedback(`Template “${name}” salvo neste documento.`);
  };

  const updateCover = (updates: Partial<NonNullable<typeof activeDocument.cover>>) => {
    const currentCover = activeDocument.cover ?? {
      color: activeDocument.coverColor,
      borderColor: activeDocument.coverBorderColor ?? "#8dcbd7",
      cornerRadius: 28,
      material: "linen" as const,
      textureIntensity: 18,
    };
    const cover = { ...currentCover, ...updates };
    updateDocument(activeDocument.id, {
      cover,
      coverColor: cover.color,
      coverBorderColor: cover.borderColor,
    });
  };

  return (
    <div className="paper-settings">
      <PropertySection title="Presets de papel" description="Aplique na página atual ou no documento inteiro">
        <div className="paper-scope-switch" role="group" aria-label="Escopo da aparência">
          <button type="button" data-active={scope === "page"} onClick={() => setScope("page")}>
            <FileText size={14} /> Página
          </button>
          <button type="button" data-active={scope === "document"} onClick={() => setScope("document")}>
            <Layers3 size={14} /> Documento
          </button>
        </div>
        <div className="paper-preset-grid">
          {BUILT_IN_PAPER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="paper-preset-card"
              data-paper-type={preset.appearance.paperType}
              style={{
                "--preset-paper-color": preset.appearance.paperColor,
                "--preset-pattern-color": preset.appearance.patternColor,
              } as CSSProperties}
              onClick={() => applyAppearance(preset.appearance)}
            >
              <span className="paper-preset-preview" aria-hidden="true" />
              <span><strong>{preset.name}</strong><small>{preset.description}</small></span>
            </button>
          ))}
        </div>
      </PropertySection>

      <PropertySection title="Página" description="Cor, pauta e textura da folha">
        <label className="property-select" htmlFor="paper-pattern">
          <span>Tipo de página</span>
          <select id="paper-pattern" value={appearance.paperType} onChange={(event) => {
            const paperType = event.target.value as PaperType;
            updateAppearance({ paperType, patternSize: getDefaultPatternSize(paperType) });
          }}>
            {patterns.map((pattern) => <option key={pattern.value} value={pattern.value}>{pattern.label}</option>)}
          </select>
        </label>
        <ColorControl id="paper-color" label="Cor do papel" value={appearance.paperColor} onChange={(paperColor) => updateAppearance({ paperColor })} />
        <label className="property-select" htmlFor="paper-texture">
          <span>Textura</span>
          <select id="paper-texture" value={appearance.paperTexture} onChange={(event) => updateAppearance({ paperTexture: event.target.value as PaperTexture })}>
            {textures.map((texture) => <option key={texture.value} value={texture.value}>{texture.label}</option>)}
          </select>
        </label>
        {appearance.paperTexture !== "none" && (
          <SliderControl id="paper-texture-intensity" label="Intensidade da textura" value={appearance.textureIntensity} min={0} max={50} step={1} unit="%" onChange={(textureIntensity) => updateAppearance({ textureIntensity })} />
        )}
      </PropertySection>

      {appearance.paperType !== "blank" && (
        <PropertySection title="Pauta" description="Cor, intensidade e espaçamento">
          <ColorControl id="pattern-color" label="Cor da pauta" value={appearance.patternColor} onChange={(patternColor) => updateAppearance({ patternColor })} />
          <SliderControl id="pattern-opacity" label="Intensidade" value={appearance.patternOpacity} min={2} max={40} step={1} unit="%" onChange={(patternOpacity) => updateAppearance({ patternOpacity })} />
          <SliderControl id="pattern-spacing" label="Espaçamento" value={appearance.patternSize} min={10} max={40} step={1} unit="px" onChange={(patternSize) => updateAppearance({ patternSize })} />
        </PropertySection>
      )}

      <PropertySection title="Margens" description="Guias visuais independentes em cada lado">
        <label className="property-toggle">
          <span><strong>Mostrar guias</strong><small>As margens não bloqueiam elementos</small></span>
          <input type="checkbox" checked={appearance.margins.visible} onChange={(event) => updateAppearance({ margins: { ...appearance.margins, visible: event.target.checked } })} />
        </label>
        <label className="property-toggle">
          <span><strong>Vincular lados</strong><small>Move as quatro margens juntas</small></span>
          <input type="checkbox" checked={linkedMargins} onChange={(event) => setLinkedMargins(event.target.checked)} />
        </label>
        <div className="paper-margin-controls">
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <SliderControl
              key={side}
              id={`paper-margin-${side}`}
              label={{ top: "Superior", right: "Direita", bottom: "Inferior", left: "Esquerda" }[side]}
              value={appearance.margins[side]}
              min={0}
              max={24}
              step={1}
              unit="%"
              onChange={(value) => updateMargin(side, value)}
            />
          ))}
        </div>
      </PropertySection>

      <PropertySection title="Templates" description="Reutilize uma aparência dentro deste documento">
        <div className="paper-template-save">
          <input
            value={templateName}
            maxLength={48}
            aria-label="Nome do template"
            placeholder="Ex.: Planejamento semanal"
            onChange={(event) => setTemplateName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveTemplate();
              }
            }}
          />
          <button type="button" aria-label="Salvar aparência como template" onClick={saveTemplate}><BookmarkPlus size={16} /> Salvar</button>
        </div>
        {(activeDocument.paperTemplates ?? []).length > 0 && (
          <div className="paper-template-list">
            {activeDocument.paperTemplates?.map((template) => (
              <div key={template.id} className="paper-template-item">
                <button type="button" onClick={() => applyAppearance(template.appearance)}><Check size={14} /> <span>{template.name}</span></button>
                <button type="button" aria-label={`Excluir template ${template.name}`} onClick={() => updateDocument(activeDocument.id, {
                  paperTemplates: activeDocument.paperTemplates?.filter((item) => item.id !== template.id),
                })}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
        {feedback && <p className="paper-settings-feedback" role="status">{feedback}</p>}
      </PropertySection>

      {activeDocument.type === "notebook" && (
        <PropertySection title="Capa" description="Material, acabamento e cantos do caderno">
          <ColorControl id="document-cover-color" label="Cor da capa" value={activeDocument.cover?.color ?? activeDocument.coverColor} onChange={(color) => updateCover({ color })} />
          <ColorControl id="document-cover-border" label="Borda e costura" value={activeDocument.cover?.borderColor ?? activeDocument.coverBorderColor ?? "#8dcbd7"} onChange={(borderColor) => updateCover({ borderColor })} />
          <label className="property-select" htmlFor="document-cover-material">
            <span>Material</span>
            <select id="document-cover-material" value={activeDocument.cover?.material ?? "linen"} onChange={(event) => updateCover({ material: event.target.value as NotebookMaterial })}>
              <option value="smooth">Lisa</option><option value="linen">Tecido</option><option value="speckled">Granulada</option>
            </select>
          </label>
          <SliderControl id="document-cover-texture" label="Intensidade do material" value={activeDocument.cover?.textureIntensity ?? 18} min={0} max={40} step={1} unit="%" onChange={(textureIntensity) => updateCover({ textureIntensity })} />
          <SliderControl id="document-cover-radius" label="Arredondamento" value={activeDocument.cover?.cornerRadius ?? 28} min={8} max={36} step={1} unit="px" onChange={(cornerRadius) => updateCover({ cornerRadius })} />
          <ColorControl id="document-spine-color" label="Lombada" value={activeDocument.spineColor ?? "#bdeff3"} onChange={(spineColor) => updateDocument(activeDocument.id, { spineColor })} />
        </PropertySection>
      )}

      {activeDocument.type === "notebook" && activeSection && (
        <PropertySection title="Divisória atual" description={`Personalize “${activeSection.title}”`}>
          <ColorControl id="divider-color" label="Cor da divisória" value={activeSection.divider.color} onChange={(color) => updateNotebookDivider(activeDocument.id, activeSection.id, { color })} />
          <label className="property-select" htmlFor="divider-material">
            <span>Material</span>
            <select id="divider-material" value={activeSection.divider.material ?? "smooth"} onChange={(event) => updateNotebookDivider(activeDocument.id, activeSection.id, { material: event.target.value as NotebookMaterial })}>
              <option value="smooth">Lisa</option><option value="linen">Tecido</option><option value="speckled">Granulada</option>
            </select>
          </label>
          <SliderControl id="divider-texture" label="Intensidade do material" value={activeSection.divider.textureIntensity ?? 12} min={0} max={40} step={1} unit="%" onChange={(textureIntensity) => updateNotebookDivider(activeDocument.id, activeSection.id, { textureIntensity })} />
        </PropertySection>
      )}
    </div>
  );
}
