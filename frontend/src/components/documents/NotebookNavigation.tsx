import { ChevronLeft, ChevronRight, FilePlus, List, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { MoctesDocument } from "../../types/document.types";
import type { NotebookSurface } from "../../types/notebook.types";
import type { PageTemplateId } from "../../types/pageTemplate.types";
import {
  getNotebookPageCount,
  getNotebookPageNumber,
  isFirstNotebookSurface,
  isLastNotebookSurface,
} from "../../utils/notebookSurfaces.utils";
import { MovePageToSectionMenu } from "./MovePageToSectionMenu";
import { PageTemplatePicker } from "../templates/PageTemplatePicker";

interface NotebookNavigationProps {
  document: MoctesDocument;
  activeSurface: NotebookSurface | undefined;
  disabled?: boolean;
  editable?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onAddPage?: (sectionId: string, templateId: PageTemplateId) => void;
  onMovePage?: (pageId: string, sectionId: string) => void;
  onSelectPage?: (pageId: string) => void;
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
    text: `${pageNumber} / ${pageCount}`,
    ariaLabel: `Página ${pageNumber} de ${pageCount}`,
  };
}

export function NotebookNavigation({
  document,
  activeSurface,
  disabled = false,
  editable = true,
  onPrevious,
  onNext,
  onAddPage,
  onMovePage,
  onSelectPage,
}: NotebookNavigationProps) {
  const [indexOpen, setIndexOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const label = getSurfaceLabel(document, activeSurface);
  const previousDisabled = disabled || !activeSurface || isFirstNotebookSurface(document, activeSurface.id);
  const nextDisabled = disabled || !activeSurface || isLastNotebookSurface(document, activeSurface.id);
  const activeSectionId = activeSurface?.sectionId;

  return (
    <div className="notebook-navigation" aria-label="Navegação do caderno">
      <button
        type="button"
        className="notebook-navigation-button"
        aria-label="Superfície anterior"
        data-tooltip="Página anterior"
        disabled={previousDisabled}
        onClick={onPrevious}
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="notebook-navigation-indicator"
        aria-label={label.ariaLabel}
        aria-haspopup="dialog"
        title="Abrir índice de páginas"
        data-tooltip="Abrir índice"
        onClick={() => setIndexOpen(true)}
      >
        <List size={13} aria-hidden="true" />
        {label.text}
      </button>
      {activeSectionId && onAddPage && (
        <button
          type="button"
          className="notebook-navigation-button"
          aria-label="Adicionar página à seção"
          data-tooltip="Adicionar página"
          disabled={disabled || !editable}
          aria-haspopup="dialog"
          aria-expanded={templatePickerOpen}
          onClick={() => setTemplatePickerOpen(true)}
        >
          <FilePlus size={15} aria-hidden="true" />
        </button>
      )}
      {activeSurface?.kind === "page" && onMovePage && (
        <MovePageToSectionMenu
          sections={document.sections ?? []}
          currentSectionId={activeSurface.sectionId}
          disabled={disabled || !editable}
          onMove={(sectionId) => onMovePage(activeSurface.id, sectionId)}
        />
      )}
      <button
        type="button"
        className="notebook-navigation-button"
        aria-label="Próxima superfície"
        data-tooltip="Próxima página"
        disabled={nextDisabled}
        onClick={onNext}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
      {activeSectionId && onAddPage && (
        <PageTemplatePicker
          open={templatePickerOpen}
          documentType={document.type}
          onClose={() => setTemplatePickerOpen(false)}
          onSelect={(templateId) => {
            onAddPage(activeSectionId, templateId);
            setTemplatePickerOpen(false);
          }}
        />
      )}
      {indexOpen && (
        <PageIndexDialog
          document={document}
          query={query}
          onQueryChange={setQuery}
          onClose={() => {
            setIndexOpen(false);
            setQuery("");
          }}
          onSelect={(pageId) => {
            onSelectPage?.(pageId);
            setIndexOpen(false);
            setQuery("");
          }}
        />
      )}
    </div>
  );
}

function PageIndexDialog({
  document,
  query,
  onQueryChange,
  onClose,
  onSelect,
}: {
  document: MoctesDocument;
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onSelect: (pageId: string) => void;
}) {
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const pages = useMemo(
    () =>
      [...document.pages]
        .sort((first, second) => first.order - second.order)
        .filter((page, index) => {
          const section = document.sections?.find(
            (item) => item.id === page.sectionId,
          );
          const searchable = `${page.title ?? ""} ${section?.title ?? ""} ${index + 1}`.toLocaleLowerCase(
            "pt-BR",
          );
          return !normalizedQuery || searchable.includes(normalizedQuery);
        }),
    [document.pages, document.sections, normalizedQuery],
  );

  return (
    <div className="page-index-backdrop" role="presentation" onClick={onClose}>
      <section
        className="page-index-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-index-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>Navegação</span>
            <h2 id="page-index-title">Páginas do caderno</h2>
          </div>
          <button type="button" aria-label="Fechar índice" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <label className="page-index-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Buscar página ou seção</span>
          <input
            autoFocus
            value={query}
            placeholder="Buscar página ou seção"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <div className="page-index-list">
          {pages.map((page) => {
            const pageNumber =
              [...document.pages]
                .sort((first, second) => first.order - second.order)
                .findIndex((item) => item.id === page.id) + 1;
            const section = document.sections?.find(
              (item) => item.id === page.sectionId,
            );
            return (
              <button
                key={page.id}
                type="button"
                data-active={page.id === document.activePageId}
                onClick={() => onSelect(page.id)}
              >
                <span>{pageNumber}</span>
                <strong>{page.title?.trim() || `Página ${pageNumber}`}</strong>
                <small>{section?.title ?? "Sem seção"}</small>
              </button>
            );
          })}
          {pages.length === 0 && (
            <p>Nenhuma página corresponde à busca.</p>
          )}
        </div>
      </section>
    </div>
  );
}
