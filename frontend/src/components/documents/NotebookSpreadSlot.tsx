import type { MoctesDocument } from "../../types/document.types";
import type { NotebookSurface } from "../../types/notebook.types";
import { NotebookSurfaceRenderer } from "./NotebookSurfaceRenderer";

interface NotebookSpreadSlotProps {
  document: MoctesDocument;
  side: "left" | "right";
  surface: NotebookSurface | null | undefined;
  editable: boolean;
  hidden?: boolean;
}

export function NotebookSpreadSlot({
  document,
  side,
  surface,
  editable,
  hidden = false,
}: NotebookSpreadSlotProps) {
  if (hidden) {
    return <div className="notebook-spread-slot" data-side={side} aria-hidden="true" />;
  }

  if (!surface) {
    return (
      <section
        className="notebook-spread-slot notebook-guard-page"
        data-side={side}
        aria-label="Folha de guarda"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className="notebook-spread-slot"
      data-side={side}
      data-editable={editable}
      aria-label={side === "left" ? "Superfície anterior" : "Superfície ativa"}
    >
      <NotebookSurfaceRenderer
        document={document}
        activeSurface={surface}
        interactive={editable}
      />
    </div>
  );
}
