import {
  BookHeart,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  File,
  FolderKanban,
  GraduationCap,
  Images,
  ListChecks,
  X,
} from "lucide-react";
import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { PAGE_TEMPLATES } from "../../data/pageTemplates";
import type { DocumentType } from "../../types/document.types";
import type { PageTemplateId } from "../../types/pageTemplate.types";

const icons = {
  diary: BookHeart,
  "daily-planner": ClipboardList,
  studies: GraduationCap,
  moodboard: Images,
  checklist: ListChecks,
  weekly: CalendarRange,
  monthly: CalendarDays,
  project: FolderKanban,
  blank: File,
} satisfies Record<PageTemplateId, typeof File>;

interface PageTemplatePickerProps {
  open: boolean;
  documentType: DocumentType;
  onSelect: (templateId: PageTemplateId) => void;
  onClose: () => void;
}

export function PageTemplatePicker({
  open,
  documentType,
  onSelect,
  onClose,
}: PageTemplatePickerProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const templates = [...PAGE_TEMPLATES].sort((first, second) => {
    const firstRecommended = first.recommendedFor.includes(documentType) ? 0 : 1;
    const secondRecommended = second.recommendedFor.includes(documentType) ? 0 : 1;
    return firstRecommended - secondRecommended;
  });

  return createPortal(
    <div className="page-template-backdrop" role="presentation" onPointerDown={onClose}>
      <section
        className="page-template-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="page-template-header">
          <div>
            <span>Nova página</span>
            <h2 id={titleId}>Escolha um template</h2>
            <p id={descriptionId}>O conteúdo será criado com elementos totalmente editáveis.</p>
          </div>
          <button type="button" aria-label="Fechar templates de página" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="page-template-grid">
          {templates.map((template) => {
            const Icon = icons[template.id];
            return (
              <button
                key={template.id}
                type="button"
                className="page-template-card"
                data-template={template.id}
                autoFocus={template.id === templates[0]?.id}
                onClick={() => onSelect(template.id)}
              >
                <span className="page-template-card-preview" aria-hidden="true">
                  <Icon size={22} />
                  <span className="page-template-preview-lines" />
                </span>
                <span className="page-template-card-copy">
                  <span>
                    <strong>{template.name}</strong>
                  </span>
                  <span>{template.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>,
    document.body,
  );
}
