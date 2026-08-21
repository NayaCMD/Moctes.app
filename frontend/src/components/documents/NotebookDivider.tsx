import type { CSSProperties } from "react";
import type { NotebookSection } from "../../types/notebook.types";

interface NotebookDividerProps {
  section: NotebookSection;
  pageCount: number;
  isActive: boolean;
}

function getPageCountLabel(pageCount: number): string {
  return pageCount === 1 ? "1 página" : `${pageCount} páginas`;
}

export function NotebookDivider({ section, pageCount, isActive }: NotebookDividerProps) {
  const title = section.title.trim() || "Seção sem título";
  const style = {
    "--divider-color": section.divider.color,
    "--divider-tab-color": section.divider.tabColor,
    "--divider-text-color": section.divider.textColor,
    "--divider-tab-position": `${section.divider.tabPosition}%`,
    "--divider-texture-opacity": `${section.divider.textureIntensity ?? 12}%`,
  } as CSSProperties;

  return (
    <section
      className="notebook-divider-surface"
      data-active={isActive}
      data-divider-material={section.divider.material ?? "smooth"}
      aria-label={`Divisória da seção ${title}`}
      style={style}
    >
      <div className="notebook-divider-content">
        <span className="notebook-divider-kicker">Divisória</span>
        <h2>{title}</h2>
        <p>{getPageCountLabel(pageCount)}</p>
      </div>
    </section>
  );
}
