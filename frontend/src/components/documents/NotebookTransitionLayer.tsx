import type { MoctesDocument } from "../../types/document.types";
import type { NotebookBinding, NotebookSurface, NotebookTransitionState } from "../../types/notebook.types";
import { getSurfaceById } from "../../utils/notebookSurfaces.utils";
import { NotebookLeaf } from "./NotebookLeaf";
import { NotebookSurfaceRenderer } from "./NotebookSurfaceRenderer";

interface NotebookTransitionLayerProps {
  document: MoctesDocument;
  activeSurface: NotebookSurface | undefined;
  binding: NotebookBinding;
  transition: NotebookTransitionState | null;
  onTransitionComplete: (transition: NotebookTransitionState) => void;
}

export function NotebookTransitionLayer({
  document,
  activeSurface,
  binding,
  transition,
  onTransitionComplete,
}: NotebookTransitionLayerProps) {
  if (!transition) {
    return (
      <div className="notebook-surface">
        <NotebookSurfaceRenderer document={document} activeSurface={activeSurface} />
      </div>
    );
  }

  const fromSurface = getSurfaceById(document, transition.fromSurfaceId);
  const toSurface = getSurfaceById(document, transition.toSurfaceId);

  if (!fromSurface || !toSurface) {
    return (
      <div className="notebook-surface">
        <NotebookSurfaceRenderer document={document} activeSurface={activeSurface} />
      </div>
    );
  }

  const baseSurface = transition.direction === "forward" ? toSurface : fromSurface;
  const leafSurface = transition.direction === "forward" ? fromSurface : toSurface;

  return (
    <div
      className="notebook-transition-layer"
      data-direction={transition.direction}
      data-phase={transition.phase}
      onTransitionEnd={(event) => {
        if (
          event.target === event.currentTarget.querySelector(".notebook-leaf") &&
          event.propertyName === "transform"
        ) {
          onTransitionComplete(transition);
        }
      }}
    >
      <div className="notebook-surface notebook-surface-base" aria-hidden="true">
        <NotebookSurfaceRenderer
          document={document}
          activeSurface={baseSurface}
          interactive={false}
        />
      </div>
      <NotebookLeaf
        document={document}
        surface={leafSurface}
        binding={binding}
        direction={transition.direction}
        phase={transition.phase}
      />
    </div>
  );
}
