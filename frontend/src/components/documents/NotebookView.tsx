import { useEffect } from "react";
import { X } from "lucide-react";
import type { MoctesDocument } from "../../types/document.types";
import type { NotebookBinding } from "../../types/notebook.types";
import { useNotebookBook } from "../../hooks/useNotebookBook";
import { useNotebookTransition } from "../../hooks/useNotebookTransition";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { createDefaultNotebookCover } from "../../utils/notebookMigration.utils";
import { isEditableTarget } from "../../utils/keyboard.utils";
import {
  buildNotebookSurfaces,
  getActiveSectionId,
  getSurfaceById,
} from "../../utils/notebookSurfaces.utils";
import { buildNotebookSpreadView } from "../../utils/notebookSpread.utils";
import { NotebookCover } from "./NotebookCover";
import { NotebookFrontCover } from "./NotebookFrontCover";
import { NotebookNavigation } from "./NotebookNavigation";
import { NotebookSpread } from "./NotebookSpread";
import { NotebookTabs } from "./NotebookTabs";

interface NotebookViewProps {
  document: MoctesDocument;
}

export function NotebookView({ document }: NotebookViewProps) {
  const notebookTransition = useNotebookTransition(document);
  const notebookBook = useNotebookBook(document);
  const selectedElementId = useDocumentStore((state) => state.selectedElementId);
  const addPageToSection = useDocumentStore((state) => state.addPageToSection);
  const movePageToSection = useDocumentStore((state) => state.movePageToSection);
  const cancelNotebookTransition = useEditorStore((state) => state.cancelNotebookTransition);
  const surfaces = buildNotebookSurfaces(document);
  const activeSurface =
    (document.activeSurfaceId
      ? getSurfaceById(document, document.activeSurfaceId)
      : undefined) ?? surfaces[0];
  const activeSectionId = getActiveSectionId(document, activeSurface);
  const cover = document.cover ?? createDefaultNotebookCover(document);
  const binding: NotebookBinding = document.binding ?? "left";
  const spread = buildNotebookSpreadView(surfaces, activeSurface?.id);
  const controlsDisabled = notebookTransition.isTransitioning || !notebookBook.isOpen || notebookBook.isBusy;

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

      if (!notebookBook.isOpen || notebookBook.isBusy || notebookTransition.isTransitioning) {
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
  }, [notebookBook.isBusy, notebookBook.isOpen, notebookTransition, selectedElementId, surfaces]);

  return (
    <article
      className="notebook-view notebook-view-v2"
      data-binding={binding}
      data-book-phase={notebookBook.state.phase}
      aria-label={document.title}
    >
      <div className="notebook-shell" data-book-phase={notebookBook.state.phase}>
        <NotebookCover cover={cover} binding={binding} />
        <NotebookSpread
          document={document}
          leftSurface={spread.leftSurface}
          rightSurface={spread.rightSurface}
          editable={notebookBook.isOpen && !notebookTransition.isTransitioning}
          transition={notebookTransition.transition}
          bookPhase={notebookBook.state.phase}
          onTransitionComplete={notebookTransition.completeTransition}
        />
        <NotebookFrontCover
          cover={cover}
          phase={notebookBook.state.phase}
          disabled={notebookBook.isBusy}
          onOpen={notebookBook.open}
          onTransitionEnd={() => {
            if (notebookBook.state.phase === "opening") {
              notebookBook.completeOpening();
            }
            if (notebookBook.state.phase === "closing") {
              notebookBook.completeClosing();
            }
          }}
        />
        {notebookBook.isOpen && (
          <button
            type="button"
            className="notebook-close-button"
            aria-label="Fechar caderno"
            onClick={notebookBook.close}
            disabled={notebookBook.isBusy || notebookTransition.isTransitioning}
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
        <NotebookTabs
          documentId={document.id}
          sections={document.sections ?? []}
          activeSectionId={activeSectionId}
          disabled={controlsDisabled}
          onSelectSection={notebookTransition.navigateToSection}
        />
        <NotebookNavigation
          document={document}
          activeSurface={spread.rightSurface}
          disabled={controlsDisabled}
          onPrevious={notebookTransition.navigatePrevious}
          onNext={notebookTransition.navigateNext}
          onAddPage={(sectionId) => {
            cancelNotebookTransition(document.id);
            addPageToSection(document.id, sectionId);
          }}
          onMovePage={(pageId, sectionId) => {
            cancelNotebookTransition(document.id);
            movePageToSection(document.id, pageId, sectionId);
          }}
        />
        <div className="notebook-book-status" aria-live="polite">
          {notebookBook.state.phase === "closed" ? "Caderno fechado" : null}
        </div>
      </div>
    </article>
  );
}
