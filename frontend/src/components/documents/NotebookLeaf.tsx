import type { MoctesDocument } from "../../types/document.types";
import type {
  NotebookBinding,
  NotebookSurface,
  NotebookTransitionDirection,
  NotebookTransitionPhase,
} from "../../types/notebook.types";
import { NotebookSurfaceRenderer } from "./NotebookSurfaceRenderer";

interface NotebookLeafProps {
  document: MoctesDocument;
  surface: NotebookSurface;
  binding: NotebookBinding;
  direction: NotebookTransitionDirection;
  phase: NotebookTransitionPhase;
}

export function NotebookLeaf({
  document,
  surface,
  binding,
  direction,
  phase,
}: NotebookLeafProps) {
  return (
    <div
      className="notebook-leaf"
      data-binding={binding}
      data-direction={direction}
      data-phase={phase}
      aria-hidden="true"
    >
      <div className="notebook-leaf__front">
        <NotebookSurfaceRenderer
          document={document}
          activeSurface={surface}
          interactive={false}
        />
      </div>
      <div className="notebook-leaf__back" aria-hidden="true" />
    </div>
  );
}
