import { createElement, useEffect, useRef } from "react";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type { PageElement } from "../../types/element.types";
import { getPostItTemplate } from "../postIts/templates/postItTemplateRegistry";

interface PostItElementProps {
  element: PageElement;
  interactive?: boolean;
}

export function PostItElement({ element, interactive = true }: PostItElementProps) {
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

  if (element.content.kind !== "post-it") {
    return null;
  }

  const content = element.content;
  const Template = getPostItTemplate(content.appearance.templateId);

  const finishEditing = () => {
    const nextText = textareaRef.current?.value ?? content.text;
    if (nextText !== content.text) {
      recordHistory(documents);
      updateElement(element.id, {
        content: {
          ...content,
          text: nextText,
        },
      });
    }
    setEditingTextElementId(null);
  };

  return (
    <span className="post-it-element">
      {Template ? (
        createElement(Template, {
          className: "post-it-element__background",
          backgroundColor: content.appearance.backgroundColor,
          patternColor: content.appearance.patternColor,
          patternOpacity: content.appearance.patternOpacity,
          preserveAspectRatio: content.appearance.preserveAspectRatio,
        })
      ) : (
        <span className="post-it-element__fallback">Template indisponivel</span>
      )}

      {isEditing ? (
        <textarea
          ref={textareaRef}
          className="post-it-element__editor"
          aria-label="Texto do post-it"
          defaultValue={content.text}
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
      ) : (
        <span
          className="post-it-element__content"
          style={{
            ...element.style.text,
            color: content.appearance.textColor,
          }}
        >
          {content.text}
        </span>
      )}
    </span>
  );
}
