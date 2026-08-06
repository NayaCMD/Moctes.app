import { useEffect } from "react";
import type { MoctesDocument } from "../../types/document.types";
import type { NotebookBinding } from "../../types/notebook.types";
import { useNotebookTransition } from "../../hooks/useNotebookTransition";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { createDefaultNotebookCover } from "../../utils/notebookMigration.utils";
import { isEditableTarget } from "../../utils/keyboard.utils";
import {
  buildNotebookSurfaces,
  getActiveSectionId,
  getSurfaceById,
} from "../../utils/notebookSurfaces.utils";
import { BindingRings } from "./BindingRings";
import { NotebookCover } from "./NotebookCover";
import { NotebookNavigation } from "./NotebookNavigation";
import { NotebookTabs } from "./NotebookTabs";
import { NotebookTransitionLayer } from "./NotebookTransitionLayer";

interface NotebookViewProps {
  document: MoctesDocument;
}

export function NotebookView({ document }: NotebookViewProps) {
  const notebookTransition = useNotebookTransition(document);
  const selectedElementId = useDocumentStore((state) => state.selectedElementId);
  const surfaces = buildNotebookSurfaces(document);
  const activeSurface =
    (document.activeSurfaceId
      ? getSurfaceById(document, document.activeSurfaceId)
      : undefined) ?? surfaces[0];
  const activeSectionId = getActiveSectionId(document, activeSurface);
  const cover = document.cover ?? createDefaultNotebookCover(document);
  const binding: NotebookBinding = document.binding ?? "left";

  useEffect(() => {
    const handleNotebookKeyDown = (event: KeyboardEvent) => {
      if (
        isEditableTarget(event.target) ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      if (notebookTransition.isTransitioning) {
        if (["ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End"].includes(event.key)) {
          event.preventDefault();
        }
        return;
      }

      const firstSurface = surfaces[0];
      const lastSurface = surfaces.at(-1);
      const shouldNavigateWithArrow = !selectedElementId && ["ArrowLeft", "ArrowRight"].includes(event.key);
      const shouldNavigate = shouldNavigateWithArrow || ["PageUp", "PageDown", "Home", "End"].includes(event.key);

      if (!shouldNavigate) {
        return;
      }

      const didNavigate =
        event.key === "ArrowLeft" || event.key === "PageUp"
          ? notebookTransition.navigatePrevious()
          : event.key === "ArrowRight" || event.key === "PageDown"
            ? notebookTransition.navigateNext()
            : event.key === "Home" && firstSurface
              ? notebookTransition.navigateToSurface(firstSurface.id)
              : event.key === "End" && lastSurface
                ? notebookTransition.navigateToSurface(lastSurface.id)
                : false;

      if (didNavigate) {
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleNotebookKeyDown);
    return () => window.removeEventListener("keydown", handleNotebookKeyDown);
  }, [notebookTransition, selectedElementId, surfaces]);

  return (
    <article
      className="notebook-view notebook-view-v2"
      data-binding={binding}
      aria-label={document.title}
    >
      <NotebookCover cover={cover} binding={binding} />
      <div className="notebook-binding" data-binding={binding}>
        <BindingRings
          orientation={binding === "top" ? "horizontal" : "vertical"}
          count={binding === "top" ? 8 : 7}
        />
      </div>
      <NotebookTabs
        sections={document.sections ?? []}
        activeSectionId={activeSectionId}
        disabled={notebookTransition.isTransitioning}
        onSelectSection={notebookTransition.navigateToSection}
      />
      <div
        className="notebook-stage"
        data-transitioning={notebookTransition.isTransitioning}
        aria-busy={notebookTransition.isTransitioning}
      >
        <NotebookTransitionLayer
          document={document}
          activeSurface={activeSurface}
          binding={binding}
          transition={notebookTransition.transition}
          onTransitionComplete={notebookTransition.completeTransition}
        />
      </div>
      <NotebookNavigation
        document={document}
        activeSurface={activeSurface}
        disabled={notebookTransition.isTransitioning}
        onPrevious={notebookTransition.navigatePrevious}
        onNext={notebookTransition.navigateNext}
      />
    </article>
  );
}
