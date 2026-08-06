import type { CSSProperties } from "react";
import type { NotebookSection } from "../../types/notebook.types";

interface NotebookTabsProps {
  sections: NotebookSection[];
  activeSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
  disabled?: boolean;
}

function clampTabPosition(position: number): number {
  return Math.min(92, Math.max(0, position));
}

export function NotebookTabs({
  sections,
  activeSectionId,
  onSelectSection,
  disabled = false,
}: NotebookTabsProps) {
  if (sections.length === 0) {
    return null;
  }

  return (
    <nav className="notebook-tabs" aria-label="Seções do caderno">
      {sections.map((section, index) => {
        const title = section.title.trim() || "Seção sem título";
        const tabPosition = clampTabPosition(section.divider.tabPosition + index * 6);
        const style = {
          "--notebook-tab-color": section.divider.tabColor,
          "--notebook-tab-text-color": section.divider.textColor,
          "--notebook-tab-position": `${tabPosition}%`,
        } as CSSProperties;

        return (
          <button
            key={section.id}
            type="button"
            className="notebook-tab"
            aria-current={activeSectionId === section.id ? "true" : undefined}
            aria-label={`Abrir divisória ${title}`}
            disabled={disabled}
            style={style}
            onClick={() => onSelectSection(section.id)}
          >
            <span>{title}</span>
          </button>
        );
      })}
    </nav>
  );
}
