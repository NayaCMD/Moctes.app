import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MoctesDocument } from "../../types/document.types";
import type { NotebookSurface } from "../../types/notebook.types";
import {
  getNotebookPageCount,
  getNotebookPageNumber,
  isFirstNotebookSurface,
  isLastNotebookSurface,
} from "../../utils/notebookSurfaces.utils";

interface NotebookNavigationProps {
  document: MoctesDocument;
  activeSurface: NotebookSurface | undefined;
  disabled?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

function getSurfaceLabel(
  document: MoctesDocument,
  activeSurface: NotebookSurface | undefined,
): { text: string; ariaLabel: string } {
  if (!activeSurface) {
    return { text: "Sem superfície", ariaLabel: "Nenhuma superfície ativa" };
  }

  if (activeSurface.kind === "divider") {
    const section = document.sections?.find((item) => item.id === activeSurface.sectionId);
    const title = section?.title.trim() || "Seção sem título";

    return { text: title, ariaLabel: `Divisória ${title}` };
  }

  const pageNumber = getNotebookPageNumber(document, activeSurface.id) ?? 1;
  const pageCount = getNotebookPageCount(document);

  return {
    text: String(pageNumber),
    ariaLabel: `Folha ${pageNumber} de ${pageCount}`,
  };
}

export function NotebookNavigation({
  document,
  activeSurface,
  disabled = false,
  onPrevious,
  onNext,
}: NotebookNavigationProps) {
  const label = getSurfaceLabel(document, activeSurface);
  const previousDisabled = disabled || !activeSurface || isFirstNotebookSurface(document, activeSurface.id);
  const nextDisabled = disabled || !activeSurface || isLastNotebookSurface(document, activeSurface.id);

  return (
    <div className="notebook-navigation" aria-label="Navegação do caderno">
      <button
        type="button"
        className="notebook-navigation-button"
        aria-label="Superfície anterior"
        disabled={previousDisabled}
        onClick={onPrevious}
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <output className="notebook-navigation-indicator" aria-label={label.ariaLabel}>
        {label.text}
      </output>
      <button
        type="button"
        className="notebook-navigation-button"
        aria-label="Próxima superfície"
        disabled={nextDisabled}
        onClick={onNext}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
