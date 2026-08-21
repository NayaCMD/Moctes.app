import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline } from "lucide-react";
import { useDocumentStore } from "../../stores/useDocumentStore";
import type { PageElement, TextElementStyle } from "../../types/element.types";
import type { PostItAppearance } from "../../types/postIt.types";

const fontFamilies = [
  { label: "Sans", value: "Inter, system-ui, sans-serif" },
  { label: "Print", value: '"Segoe Print", "Comic Sans MS", cursive' },
  { label: "Serif", value: "Georgia, serif" },
];

function findSelectedEditableElement(
  documents: ReturnType<typeof useDocumentStore.getState>["documents"],
  selectedId: string | null,
): PageElement | null {
  for (const document of documents) {
    for (const page of document.pages) {
      const element = page.elements.find((item) => item.id === selectedId);
      if (
        (element?.type === "text" && element.content.kind === "text") ||
        (element?.type === "post-it" && element.content.kind === "post-it")
      ) {
        return element;
      }
    }
  }
  return null;
}

export function TextToolbar() {
  const documents = useDocumentStore((state) => state.documents);
  const selectedElementId = useDocumentStore((state) => state.selectedElementId);
  const updateElement = useDocumentStore((state) => state.updateElement);
  const updateElementStyle = useDocumentStore((state) => state.updateElementStyle);
  const element = findSelectedEditableElement(documents, selectedElementId);

  if (!element || element.locked) {
    return null;
  }

  const textStyle = element.style.text ?? {};
  const postItContent = element.content.kind === "post-it" ? element.content : null;
  const updateTextStyle = (updates: TextElementStyle) => {
    updateElementStyle(element.id, {
      text: { ...textStyle, ...updates },
    });
  };
  const updatePostItAppearance = (updates: Partial<PostItAppearance>) => {
    if (!postItContent) {
      return;
    }
    const appearance = { ...postItContent.appearance, ...updates };
    updateElement(element.id, {
      lockAspectRatio: appearance.preserveAspectRatio,
      content: {
        ...postItContent,
        appearance,
      },
    });
  };

  return (
    <div className="text-toolbar" role="toolbar" aria-label="Formatação do texto">
      <select
        aria-label="Fonte"
        value={textStyle.fontFamily ?? fontFamilies[0].value}
        onChange={(event) => updateTextStyle({ fontFamily: event.target.value })}
      >
        {fontFamilies.map((font) => (
          <option key={font.value} value={font.value}>
            {font.label}
          </option>
        ))}
      </select>
      <input
        aria-label="Tamanho da fonte"
        type="number"
        min={8}
        max={72}
        value={textStyle.fontSize ?? 14}
        onChange={(event) => updateTextStyle({ fontSize: Number(event.target.value) })}
      />
      <input
        aria-label="Cor do texto"
        type="color"
        value={postItContent?.appearance.textColor ?? textStyle.color ?? "#26324a"}
        onChange={(event) =>
          postItContent
            ? updatePostItAppearance({ textColor: event.target.value })
            : updateTextStyle({ color: event.target.value })
        }
      />
      {postItContent && (
        <>
          <input
            aria-label="Cor do fundo do post-it"
            type="color"
            value={postItContent.appearance.backgroundColor}
            onChange={(event) => updatePostItAppearance({ backgroundColor: event.target.value })}
          />
          <input
            aria-label="Cor do padrão do post-it"
            type="color"
            value={postItContent.appearance.patternColor}
            onChange={(event) => updatePostItAppearance({ patternColor: event.target.value })}
          />
          <label className="text-toolbar-slider">
            Padrao
            <input
              aria-label="Opacidade do padrão"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={postItContent.appearance.patternOpacity}
              onChange={(event) => updatePostItAppearance({ patternOpacity: Number(event.target.value) })}
            />
          </label>
          <label className="text-toolbar-check">
            <input
              type="checkbox"
              checked={postItContent.appearance.preserveAspectRatio}
              onChange={(event) => updatePostItAppearance({ preserveAspectRatio: event.target.checked })}
            />
            Manter proporcao
          </label>
        </>
      )}
      <button
        type="button"
        aria-label="Negrito"
        data-active={Number(textStyle.fontWeight ?? 400) >= 700}
        onClick={() => updateTextStyle({ fontWeight: Number(textStyle.fontWeight ?? 400) >= 700 ? 400 : 800 })}
      >
        <Bold size={15} />
      </button>
      <button
        type="button"
        aria-label="Itálico"
        data-active={textStyle.fontStyle === "italic"}
        onClick={() => updateTextStyle({ fontStyle: textStyle.fontStyle === "italic" ? "normal" : "italic" })}
      >
        <Italic size={15} />
      </button>
      <button
        type="button"
        aria-label="Sublinhado"
        data-active={textStyle.textDecoration === "underline"}
        onClick={() => updateTextStyle({ textDecoration: textStyle.textDecoration === "underline" ? "none" : "underline" })}
      >
        <Underline size={15} />
      </button>
      <button type="button" aria-label="Alinhar à esquerda" onClick={() => updateTextStyle({ textAlign: "left" })}>
        <AlignLeft size={15} />
      </button>
      <button type="button" aria-label="Centralizar" onClick={() => updateTextStyle({ textAlign: "center" })}>
        <AlignCenter size={15} />
      </button>
      <button type="button" aria-label="Alinhar à direita" onClick={() => updateTextStyle({ textAlign: "right" })}>
        <AlignRight size={15} />
      </button>
    </div>
  );
}
