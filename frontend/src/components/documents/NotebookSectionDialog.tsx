import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface NotebookSectionDialogSubmit {
  title: string;
  color?: string;
}

interface NotebookSectionDialogProps {
  open: boolean;
  mode: "add" | "rename";
  initialTitle?: string;
  initialColor?: string;
  onSubmit: (values: NotebookSectionDialogSubmit) => void;
  onCancel: () => void;
}

const MAX_SECTION_TITLE_LENGTH = 80;

export function NotebookSectionDialog({
  open,
  mode,
  initialTitle = "",
  initialColor = "#d9f4f7",
  onSubmit,
  onCancel,
}: NotebookSectionDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [color, setColor] = useState(initialColor);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

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

  if (!open) {
    return null;
  }

  const dialogTitle = mode === "add" ? "Adicionar seção" : "Renomear seção";
  const description =
    mode === "add"
      ? "Crie uma nova matéria ou tópico para organizar as folhas."
      : "Atualize o nome da seção mantendo suas folhas e divisória.";

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError("Informe um título para a seção.");
      return;
    }
    onSubmit({ title: nextTitle, color: mode === "add" ? color : undefined });
  };

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form
        className="notebook-section-dialog confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 id={titleId}>{dialogTitle}</h2>
        <p id={descriptionId}>{description}</p>
        <label className="notebook-form-field">
          <span>Título</span>
          <input
            ref={inputRef}
            value={title}
            maxLength={MAX_SECTION_TITLE_LENGTH}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setTitle(event.target.value);
              setError("");
            }}
          />
        </label>
        {mode === "add" && (
          <label className="notebook-form-field">
            <span>Cor da divisória</span>
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
          </label>
        )}
        {error && (
          <p id={errorId} className="notebook-form-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" data-primary="true">
            {mode === "add" ? "Criar seção" : "Salvar"}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
