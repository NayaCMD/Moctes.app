import type { MoctesDocument } from "../../types/document.types";
import type { NotebookSurface, NotebookTransitionState } from "../../types/notebook.types";
import { NotebookSpreadSlot } from "./NotebookSpreadSlot";
import { NotebookSpine } from "./NotebookSpine";
import { NotebookTransitionLayer } from "./NotebookTransitionLayer";

interface NotebookSpreadProps {
  document: MoctesDocument;
  leftSurface: NotebookSurface | null;
  rightSurface: NotebookSurface | undefined;
  editable: boolean;
  transition: NotebookTransitionState | null;
  bookPhase?: "closed" | "opening" | "open" | "closing";
  onTransitionComplete: (transition: NotebookTransitionState) => void;
}

export function NotebookSpread({
  document,
  leftSurface,
  rightSurface,
  editable,
  transition,
  bookPhase = "open",
  onTransitionComplete,
}: NotebookSpreadProps) {
  const hideLeftSurface =
    transition?.direction === "backward" && leftSurface?.id === transition.toSurfaceId;

  return (
    <div className="notebook-spread" aria-label="Caderno aberto">
      <NotebookSpreadSlot
        document={document}
        side="left"
        surface={leftSurface}
        editable={false}
        hidden={hideLeftSurface}
      />
      <NotebookSpine mode={bookPhase === "open" ? "open" : "closed"} />
      <div
        className="notebook-stage"
        data-transitioning={Boolean(transition)}
        aria-busy={Boolean(transition)}
      >
        <NotebookTransitionLayer
          document={document}
          activeSurface={rightSurface}
          binding="left"
          transition={transition}
          interactive={editable}
          onTransitionComplete={onTransitionComplete}
        />
      </div>
    </div>
  );
}
