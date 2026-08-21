import { type FormEvent, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { RemoveSectionStrategy, NotebookSection } from "../../types/notebook.types";

interface NotebookSectionRemoveDialogProps {
  open: boolean;
  section: NotebookSection | null;
  sections: NotebookSection[];
  pageCount: number;
  onConfirm: (strategy: RemoveSectionStrategy) => void;
  onCancel: () => void;
}

type RemoveMode = "delete-pages" | "move-pages";

export function NotebookSectionRemoveDialog({
  open,
  section,
  sections,
  pageCount,
  onConfirm,
  onCancel,
}: NotebookSectionRemoveDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const otherSections = useMemo(
    () => sections.filter((item) => item.id !== section?.id),
    [section?.id, sections],
  );
  const [mode, setMode] = useState<RemoveMode>(
    pageCount > 0 && otherSections.length > 0 ? "move-pages" : "delete-pages",
  );
  const [targetSectionId, setTargetSectionId] = useState(otherSections[0]?.id ?? "");

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

  const canMovePages = pageCount > 0 && otherSections.length > 0;
  const isLastSection = sections.length <= 1;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isLastSection) {
      return;
    }
    if (mode === "move-pages" && targetSectionId) {
      onConfirm({ mode: "move-pages", targetSectionId });
      return;
    }
    onConfirm({ mode: "delete-pages" });
  };

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form
        className="notebook-section-remove-dialog confirmation-dialog"
        data-variant="danger"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 id={titleId}>Excluir seção</h2>
        <p id={descriptionId}>
          {isLastSection
            ? "O caderno precisa manter ao menos uma seção válida."
            : `Escolha o que fazer com ${pageCount} página${pageCount === 1 ? "" : "s"} de ${section.title}.`}
        </p>
        {!isLastSection && pageCount > 0 && (
          <fieldset className="notebook-remove-options">
            <legend>Estratégia</legend>
            {canMovePages && (
              <label>
                <input
                  type="radio"
                  name="remove-section-mode"
                  checked={mode === "move-pages"}
                  onChange={() => setMode("move-pages")}
                />
                <span>Mover páginas para outra seção</span>
              </label>
            )}
            <label>
              <input
                type="radio"
                name="remove-section-mode"
                checked={mode === "delete-pages"}
                onChange={() => setMode("delete-pages")}
              />
              <span>Excluir a seção e suas páginas</span>
            </label>
          </fieldset>
        )}
        {!isLastSection && canMovePages && mode === "move-pages" && (
          <label className="notebook-form-field">
            <span>Seção de destino</span>
            <select
              value={targetSectionId}
              onChange={(event) => setTargetSectionId(event.target.value)}
            >
              {otherSections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title.trim() || "Seção sem título"}
                </option>
              ))}
            </select>
          </label>
        )}
        <footer>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" data-primary="true" disabled={isLastSection}>
            Excluir seção
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
