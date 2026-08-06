import type { CSSProperties } from "react";
import type { NotebookSection } from "../../types/notebook.types";

interface NotebookDividerProps {
  section: NotebookSection;
  isActive: boolean;
}

function getPageCountLabel(pageCount: number): string {
  return pageCount === 1 ? "1 folha" : `${pageCount} folhas`;
}

export function NotebookDivider({ section, isActive }: NotebookDividerProps) {
  const title = section.title.trim() || "Seção sem título";
  const style = {
    "--divider-color": section.divider.color,
    "--divider-tab-color": section.divider.tabColor,
    "--divider-text-color": section.divider.textColor,
    "--divider-tab-position": `${section.divider.tabPosition}%`,
  } as CSSProperties;

  return (
    <section
      className="notebook-divider-surface"
      data-active={isActive}
      aria-label={`Divisória da seção ${title}`}
      style={style}
    >
      <div className="notebook-divider-tab-marker" aria-hidden="true" />
      <div className="notebook-divider-content">
        <span className="notebook-divider-kicker">Divisória</span>
        <h2>{title}</h2>
        <p>{getPageCountLabel(section.pages.length)}</p>
      </div>
    </section>
  );
}
