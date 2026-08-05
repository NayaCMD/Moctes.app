import type { MoctesDocument } from "../../types/document.types";
import type { Page } from "../../types/page.types";

interface PageNavigationProps {
  document: MoctesDocument;
  pages: Page[];
}

export function PageNavigation({
  document,
  pages,
}: PageNavigationProps) {
  if (pages.length === 0) {
    return null;
  }

  const activeIndex = Math.max(
    0,
    pages.findIndex(
      (page) => page.id === document.activePageId,
    ),
  );

  const activePage = pages[activeIndex] ?? pages[0];

  /*
   * No caderno:
   *
   * páginas 1–2 -> mostra 2
   * páginas 3–4 -> mostra 4
   * páginas 5–6 -> mostra 6
   *
   * Se houver uma quantidade ímpar:
   *
   * páginas 5–5 -> mostra 5
   */
  const spreadStartIndex =
    activeIndex - (activeIndex % 2);

  const spreadStartNumber =
    spreadStartIndex + 1;

  const spreadEndNumber = Math.min(
    spreadStartIndex + 2,
    pages.length,
  );

  const displayedPageNumber =
    document.type === "notebook"
      ? spreadEndNumber
      : activePage?.order ?? activeIndex + 1;

  const accessibleLabel =
    document.type === "notebook"
      ? spreadStartNumber === spreadEndNumber
        ? `Página ${spreadEndNumber} de ${pages.length}`
        : `Páginas ${spreadStartNumber} a ${spreadEndNumber} de ${pages.length}`
      : `Página ${displayedPageNumber} de ${pages.length}`;

  return (
    <div
      className="page-number-control"
      aria-label="Página atual"
    >
      <button
        type="button"
        className="page-number-button"
        aria-label={accessibleLabel}
        title={accessibleLabel}
        disabled
      >
        {displayedPageNumber}
      </button>
    </div>
  );
}