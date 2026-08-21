import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { useDocumentStore } from "../../stores/useDocumentStore";
import type { MoctesDocument } from "../../types/document.types";
import type { Page } from "../../types/page.types";
import { PageTemplatePicker } from "../templates/PageTemplatePicker";

interface PageNavigationProps {
  document: MoctesDocument;
  pages: Page[];
}

export function PageNavigation({ document, pages }: PageNavigationProps) {
  const setActivePage = useDocumentStore((state) => state.setActivePage);
  const createPageFromTemplate = useDocumentStore((state) => state.createPageFromTemplate);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  if (pages.length === 0) return null;

  const activeIndex = Math.max(
    0,
    pages.findIndex((page) => page.id === document.activePageId),
  );
  const activePage = pages[activeIndex] ?? pages[0];
  const displayedPageNumber = activePage?.order ?? activeIndex + 1;
  const accessibleLabel = `Página ${displayedPageNumber} de ${pages.length}`;

  return (
    <div className="page-number-control" aria-label="Navegação de páginas">
      <button
        type="button"
        aria-label="Página anterior"
        data-tooltip="Página anterior"
        disabled={activeIndex === 0}
        onClick={() => setActivePage(pages[activeIndex - 1].id)}
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      <output className="page-number-indicator" aria-label={accessibleLabel}>
        <strong>{displayedPageNumber}</strong>
        <span>/ {pages.length}</span>
      </output>
      <button
        type="button"
        aria-label="Adicionar página"
        data-tooltip="Adicionar página"
        aria-haspopup="dialog"
        aria-expanded={templatePickerOpen}
        onClick={() => setTemplatePickerOpen(true)}
      >
        <Plus size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Próxima página"
        data-tooltip="Próxima página"
        disabled={activeIndex === pages.length - 1}
        onClick={() => setActivePage(pages[activeIndex + 1].id)}
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
      <PageTemplatePicker
        open={templatePickerOpen}
        documentType={document.type}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={(templateId) => {
          createPageFromTemplate({ documentId: document.id, templateId });
          setTemplatePickerOpen(false);
        }}
      />
    </div>
  );
}
