import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type ConfirmationVariant = "default" | "warning" | "danger";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: ConfirmationVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    confirmRef.current?.focus();
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

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="confirmation-dialog"
        data-variant={variant}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="confirmation-title">{title}</h2>
        <p>{description}</p>
        <footer>
          <button type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button ref={confirmRef} type="button" data-primary="true" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
