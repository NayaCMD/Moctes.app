import {
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useKeepFocusedEditorVisible } from "../../hooks/useKeepFocusedEditorVisible";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import type {
  ChecklistElementContent,
  ChecklistItem,
  PageElement,
} from "../../types/element.types";
import { moveChecklistItem } from "../../utils/checklist.utils";

interface ChecklistElementProps {
  element: PageElement;
  interactive?: boolean;
}

export function ChecklistElement({
  element,
  interactive = true,
}: ChecklistElementProps) {
  const updateElement = useDocumentStore((state) => state.updateElement);
  const editingTextElementId = useEditorStore((state) => state.editingTextElementId);
  const setEditingTextElementId = useEditorStore((state) => state.setEditingTextElementId);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const isEditing = interactive && editingTextElementId === element.id;
  useKeepFocusedEditorVisible(isEditing, titleRef);

  useEffect(() => {
    if (isEditing) titleRef.current?.focus();
  }, [isEditing]);

  if (element.content.kind !== "checklist") return null;
  const content = element.content;
  const appearance = content.appearance;
  const style = {
    "--checklist-accent": appearance.accentColor,
    "--checklist-text": appearance.textColor,
    "--checklist-completed": appearance.completedColor,
    "--checklist-background": appearance.backgroundColor,
  } as CSSProperties;

  const updateContent = (updates: Partial<ChecklistElementContent>) => {
    updateElement(element.id, { content: { ...content, ...updates } });
  };

  const updateItems = (items: ChecklistItem[]) => updateContent({ items });

  const updateItem = (itemId: string, updates: Partial<ChecklistItem>) => {
    updateItems(
      content.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    );
  };

  const moveItem = (itemId: string, targetIndex: number) => {
    updateItems(moveChecklistItem(content.items, itemId, targetIndex));
  };

  return (
    <div
      className="page-checklist-element"
      data-editing={isEditing}
      data-marker={appearance.markerStyle}
      data-surface={appearance.surfaceStyle}
      style={style}
    >
      {isEditing ? (
        <input
          ref={titleRef}
          className="checklist-title-input"
          aria-label="Título da checklist"
          defaultValue={content.title}
          placeholder="Título opcional"
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onBlur={(event) => {
            if (event.target.value !== content.title) {
              updateContent({ title: event.target.value });
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditingTextElementId(null);
          }}
        />
      ) : (
        content.title && <strong className="checklist-title">{content.title}</strong>
      )}

      <div className="checklist-items" role="list">
        {content.items.map((item, index) => (
          <div
            key={item.id}
            className="checklist-item"
            data-completed={item.completed}
            data-dragging={draggedItemId === item.id}
            role="listitem"
            draggable={isEditing}
            onDragStart={(event) => {
              setDraggedItemId(item.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", item.id);
            }}
            onDragEnd={() => setDraggedItemId(null)}
            onDragOver={(event) => {
              if (isEditing) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const sourceId = draggedItemId || event.dataTransfer.getData("text/plain");
              if (sourceId) moveItem(sourceId, index);
              setDraggedItemId(null);
            }}
          >
            {isEditing && (
              <span className="checklist-drag-handle" title="Arrastar para reordenar">
                <GripVertical size={14} aria-hidden="true" />
              </span>
            )}
            <button
              type="button"
              className="checklist-marker"
              aria-label={
                item.completed
                  ? `Desfazer conclusão de ${item.text}`
                  : `Concluir ${item.text}`
              }
              aria-pressed={item.completed}
              onPointerDown={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              onClick={() => updateItem(item.id, { completed: !item.completed })}
            >
              {item.completed && <Check size={12} strokeWidth={3} aria-hidden="true" />}
            </button>

            {isEditing ? (
              <input
                className="checklist-item-input"
                aria-label={`Texto do item ${index + 1}`}
                defaultValue={item.text}
                onPointerDown={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onBlur={(event) => {
                  if (event.target.value !== item.text) {
                    updateItem(item.id, { text: event.target.value });
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setEditingTextElementId(null);
                }}
              />
            ) : (
              <span className="checklist-item-text">{item.text}</span>
            )}

            {isEditing && (
              <span className="checklist-item-actions">
                <button
                  type="button"
                  aria-label={`Mover ${item.text} para cima`}
                  disabled={index === 0}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => moveItem(item.id, index - 1)}
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  type="button"
                  aria-label={`Mover ${item.text} para baixo`}
                  disabled={index === content.items.length - 1}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => moveItem(item.id, index + 1)}
                >
                  <ChevronDown size={13} />
                </button>
                <button
                  type="button"
                  aria-label={`Excluir ${item.text}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => updateItems(content.items.filter((candidate) => candidate.id !== item.id))}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            )}
          </div>
        ))}
      </div>

      {isEditing && (
        <button
          type="button"
          className="checklist-add-item"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() =>
            updateItems([
              ...content.items,
              { id: `check-${crypto.randomUUID()}`, text: "Novo item", completed: false },
            ])
          }
        >
          <Plus size={14} />
          Adicionar item
        </button>
      )}
    </div>
  );
}
