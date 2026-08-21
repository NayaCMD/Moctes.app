import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  ListChecks,
  Pencil,
  Trash2,
  Type,
} from "lucide-react";
import { useMemo, useRef } from "react";
import { useAppStore } from "../../stores/useAppStore";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type {
  ChecklistAppearance,
  PageElement,
  TapeEdgeStyle,
  TapeRenderMode,
} from "../../types/element.types";
import {
  checklistToText,
  textToChecklistContent,
} from "../../utils/checklist.utils";
import { getElementSizing } from "../../utils/elementSizing.utils";
import {
  DEFAULT_TAPE_EDGE_STYLE,
  DEFAULT_TAPE_RENDER_MODE,
} from "../../utils/tape.utils";
import { ColorControl, PropertySection, SliderControl } from "./PropertyControls";

const elementTypeLabel: Record<PageElement["type"], string> = {
  text: "Texto",
  checklist: "Checklist",
  emoji: "Emoji",
  shape: "Forma",
  sticker: "Sticker",
  image: "Imagem",
  tape: "Tape",
  "post-it": "Post-it",
  comment: "Comentário",
  drawing: "Desenho",
};

export function SelectedElementProperties() {
  const documents = useDocumentStore((state) => state.documents);
  const selectedElementId = useDocumentStore((state) => state.selectedElementId);
  const updateElement = useDocumentStore((state) => state.updateElement);
  const duplicateElement = useDocumentStore((state) => state.duplicateElement);
  const deleteElement = useDocumentStore((state) => state.deleteElement);
  const bringElementToFront = useDocumentStore((state) => state.bringElementToFront);
  const sendElementToBack = useDocumentStore((state) => state.sendElementToBack);
  const setEditingTextElementId = useEditorStore((state) => state.setEditingTextElementId);
  const setSidebarVisible = useAppStore((state) => state.setSidebarVisible);
  const element = useMemo(() => findElement(documents, selectedElementId), [documents, selectedElementId]);
  const editableText = readEditableText(element);
  const textFieldRef = useRef<HTMLTextAreaElement | null>(null);

  if (!element) {
    return (
      <PropertySection
        title="Nenhum elemento selecionado"
        description="Toque em um elemento no caderno para editar suas propriedades."
      >
        <p className="selected-element-empty">As propriedades do documento continuam disponíveis abaixo.</p>
      </PropertySection>
    );
  }

  const commitText = () => {
    const textDraft = textFieldRef.current?.value;
    if (editableText === null || textDraft === undefined || textDraft === editableText) return;
    if (element.content.kind === "text") {
      updateElement(element.id, { content: { ...element.content, text: textDraft } });
    } else if (element.content.kind === "post-it") {
      updateElement(element.id, { content: { ...element.content, text: textDraft } });
    }
  };

  const canEditOnCanvas = element.content.kind === "text" || element.content.kind === "post-it";
  const checklistContent = element.content.kind === "checklist" ? element.content : null;
  const tapeContent = element.content.kind === "tape" ? element.content : null;
  const updateTapeContent = (updates: {
    renderMode?: TapeRenderMode;
    edgeStyle?: TapeEdgeStyle;
  }) => {
    if (!tapeContent) return;
    updateElement(element.id, { content: { ...tapeContent, ...updates } });
  };
  const updateChecklistAppearance = (updates: Partial<ChecklistAppearance>) => {
    if (!checklistContent) return;
    updateElement(element.id, {
      content: {
        ...checklistContent,
        appearance: { ...checklistContent.appearance, ...updates },
      },
    });
  };

  const convertTextToChecklist = () => {
    if (element.content.kind !== "text") return;
    const sizing = getElementSizing("checklist");
    updateElement(element.id, {
      type: "checklist",
      content: textToChecklistContent(element.content),
      width: Math.max(element.width, sizing.defaultWidth),
      height: Math.max(element.height, sizing.defaultHeight),
      minWidth: sizing.minWidth,
      minHeight: sizing.minHeight,
      lockAspectRatio: false,
      style: {},
    });
    setEditingTextElementId(element.id);
  };

  const convertChecklistToText = () => {
    if (!checklistContent) return;
    const sizing = getElementSizing("text");
    updateElement(element.id, {
      type: "text",
      content: { kind: "text", text: checklistToText(checklistContent) },
      minWidth: sizing.minWidth,
      minHeight: sizing.minHeight,
      lockAspectRatio: false,
      style: {
        text: {
          color: checklistContent.appearance.textColor,
          fontSize: 14,
          lineHeight: 1.45,
        },
      },
    });
    setEditingTextElementId(element.id);
  };

  return (
    <PropertySection
      title={elementTypeLabel[element.type]}
      description="Propriedades do elemento selecionado"
    >
      {editableText !== null && (
        <label className="selected-element-text-field">
          <span>Conteúdo</span>
          <textarea
            key={`${element.id}:${editableText}`}
            ref={textFieldRef}
            aria-label="Conteúdo do elemento"
            defaultValue={editableText}
            rows={4}
            onBlur={commitText}
          />
        </label>
      )}

      {tapeContent && (
        <div className="tape-properties" aria-label="Aparência da tape">
          <fieldset className="tape-property-group">
            <legend>Preenchimento</legend>
            <div className="tape-option-grid" data-columns="2">
              <button
                type="button"
                data-active={(tapeContent.renderMode ?? DEFAULT_TAPE_RENDER_MODE) === "repeat"}
                aria-pressed={(tapeContent.renderMode ?? DEFAULT_TAPE_RENDER_MODE) === "repeat"}
                onClick={() => updateTapeContent({ renderMode: "repeat" })}
              >
                Repetir padrão
              </button>
              <button
                type="button"
                data-active={(tapeContent.renderMode ?? DEFAULT_TAPE_RENDER_MODE) === "crop"}
                aria-pressed={(tapeContent.renderMode ?? DEFAULT_TAPE_RENDER_MODE) === "crop"}
                onClick={() => updateTapeContent({ renderMode: "crop" })}
              >
                Recortar
              </button>
            </div>
            <small>O padrão mantém sua proporção ao alterar a largura.</small>
          </fieldset>

          <fieldset className="tape-property-group">
            <legend>Bordas</legend>
            <div className="tape-option-grid" data-columns="3">
              {([
                ["straight", "Reta"],
                ["torn-soft", "Suave"],
                ["torn-rough", "Rústica"],
              ] as const).map(([edgeStyle, label]) => (
                <button
                  key={edgeStyle}
                  type="button"
                  data-active={(tapeContent.edgeStyle ?? DEFAULT_TAPE_EDGE_STYLE) === edgeStyle}
                  aria-pressed={(tapeContent.edgeStyle ?? DEFAULT_TAPE_EDGE_STYLE) === edgeStyle}
                  onClick={() => updateTapeContent({ edgeStyle })}
                >
                  <span className="tape-edge-swatch" data-edge={edgeStyle} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <SliderControl
            id={`tape-opacity-${element.id}`}
            label="Opacidade"
            value={Math.round((element.style.image?.opacity ?? 1) * 100)}
            min={10}
            max={100}
            step={1}
            unit="%"
            onChange={(opacity) =>
              updateElement(element.id, {
                style: {
                  ...element.style,
                  image: { ...element.style.image, opacity: opacity / 100 },
                },
              })
            }
          />

          <fieldset className="tape-property-group">
            <legend>Camada</legend>
            <div className="tape-layer-actions">
              <button type="button" onClick={() => sendElementToBack(element.id)}>
                <ArrowDownToLine size={16} />
                Atrás de tudo
              </button>
              <button type="button" onClick={() => bringElementToFront(element.id)}>
                <ArrowUpToLine size={16} />
                Sobre tudo
              </button>
            </div>
          </fieldset>
        </div>
      )}

      {checklistContent && (
        <div className="checklist-properties" aria-label="Aparência da checklist">
          <p className="checklist-progress-summary">
            <strong>
              {checklistContent.items.filter((item) => item.completed).length} de{" "}
              {checklistContent.items.length}
            </strong>{" "}
            itens concluídos
          </p>

          <fieldset className="checklist-property-group">
            <legend>Superfície</legend>
            <div className="checklist-option-grid" data-columns="3">
              {([
                ["transparent", "Livre"],
                ["paper", "Papel"],
                ["highlight", "Destaque"],
              ] as const).map(([surfaceStyle, label]) => (
                <button
                  key={surfaceStyle}
                  type="button"
                  data-active={checklistContent.appearance.surfaceStyle === surfaceStyle}
                  aria-pressed={checklistContent.appearance.surfaceStyle === surfaceStyle}
                  onClick={() => updateChecklistAppearance({ surfaceStyle })}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="checklist-property-group">
            <legend>Marcador</legend>
            <div className="checklist-option-grid" data-columns="2">
              {([
                ["circle", "Circular"],
                ["square", "Quadrado"],
              ] as const).map(([markerStyle, label]) => (
                <button
                  key={markerStyle}
                  type="button"
                  data-active={checklistContent.appearance.markerStyle === markerStyle}
                  aria-pressed={checklistContent.appearance.markerStyle === markerStyle}
                  onClick={() => updateChecklistAppearance({ markerStyle })}
                >
                  <span className="checklist-marker-swatch" data-marker={markerStyle} />
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <ColorControl
            id={`checklist-accent-${element.id}`}
            label="Cor dos marcadores"
            value={checklistContent.appearance.accentColor}
            onChange={(accentColor) => updateChecklistAppearance({ accentColor })}
          />
          <ColorControl
            id={`checklist-text-${element.id}`}
            label="Cor do texto"
            value={checklistContent.appearance.textColor}
            onChange={(textColor) => updateChecklistAppearance({ textColor })}
          />
          <ColorControl
            id={`checklist-background-${element.id}`}
            label="Cor do fundo"
            value={checklistContent.appearance.backgroundColor}
            onChange={(backgroundColor) => updateChecklistAppearance({ backgroundColor })}
          />
        </div>
      )}

      <SliderControl
        id={`element-rotation-${element.id}`}
        label="Rotação"
        value={Math.round(element.rotation)}
        min={-180}
        max={180}
        step={1}
        unit="°"
        onChange={(rotation) => updateElement(element.id, { rotation })}
      />

      <div className="selected-element-toggle-grid">
        <button
          type="button"
          className="selected-element-toggle"
          data-active={element.locked}
          aria-pressed={element.locked}
          onClick={() => updateElement(element.id, { locked: !element.locked })}
        >
          {element.locked ? <Lock size={17} /> : <LockOpen size={17} />}
          {element.locked ? "Bloqueado" : "Desbloqueado"}
        </button>
        <button
          type="button"
          className="selected-element-toggle"
          data-active={element.hidden}
          aria-pressed={element.hidden}
          onClick={() => updateElement(element.id, { hidden: !element.hidden })}
        >
          {element.hidden ? <EyeOff size={17} /> : <Eye size={17} />}
          {element.hidden ? "Oculto" : "Visível"}
        </button>
      </div>

      <div className="selected-element-actions">
        {(canEditOnCanvas || checklistContent) && (
          <button
            type="button"
            onClick={() => {
              commitText();
              setEditingTextElementId(element.id);
              setSidebarVisible(false);
            }}
          >
            <Pencil size={17} />
            Editar no caderno
          </button>
        )}
        {element.content.kind === "text" && (
          <button type="button" onClick={convertTextToChecklist}>
            <ListChecks size={17} />
            Converter em checklist
          </button>
        )}
        {checklistContent && (
          <button type="button" onClick={convertChecklistToText}>
            <Type size={17} />
            Converter em texto
          </button>
        )}
        <button type="button" onClick={() => duplicateElement(element.id)}>
          <Copy size={17} />
          Duplicar
        </button>
        <button
          type="button"
          className="selected-element-delete"
          onClick={() => deleteElement(element.id)}
        >
          <Trash2 size={17} />
          Excluir
        </button>
      </div>
    </PropertySection>
  );
}

function findElement(
  documents: ReturnType<typeof useDocumentStore.getState>["documents"],
  elementId: string | null,
): PageElement | null {
  if (!elementId) return null;
  for (const document of documents) {
    for (const page of document.pages) {
      const element = page.elements.find((candidate) => candidate.id === elementId);
      if (element) return element;
    }
  }
  return null;
}

function readEditableText(element: PageElement | null): string | null {
  if (element?.content.kind === "text" || element?.content.kind === "post-it") {
    return element.content.text;
  }
  return null;
}
