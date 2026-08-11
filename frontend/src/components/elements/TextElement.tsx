import { useEffect, useRef } from "react";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type { PageElement } from "../../types/element.types";

interface TextElementProps {
  element: PageElement;
  interactive?: boolean;
}

export function TextElement({ element, interactive = true }: TextElementProps) {
  const documents = useDocumentStore((state) => state.documents);
  const updateElement = useDocumentStore((state) => state.updateElement);
  const editingTextElementId = useEditorStore((state) => state.editingTextElementId);
  const setEditingTextElementId = useEditorStore((state) => state.setEditingTextElementId);
  const recordHistory = useEditorStore((state) => state.recordHistory);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isEditing = interactive && editingTextElementId === element.id;

  useEffect(() => {
    if (isEditing) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [isEditing]);

  if (element.content.kind !== "text") {
    return null;
  }
  const textContent = element.content;

  const finishEditing = () => {
    const nextText = textareaRef.current?.value ?? textContent.text;
    if (nextText !== textContent.text) {
      recordHistory(documents);
      updateElement(element.id, { content: { kind: "text", text: nextText } });
    }
    setEditingTextElementId(null);
  };

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        className="page-text-editor"
        aria-label="Editar texto"
        defaultValue={textContent.text}
        style={element.style.text}
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onBlur={finishEditing}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setEditingTextElementId(null);
          }
        }}
      />
    );
  }

  return (
    <span className="page-text-element" style={element.style.text}>
      {textContent.text}
    </span>
  );
}
