import type { MoctesDocument } from "../../types/document.types";
import { getOrderedPages } from "../../utils/document.utils";
import { BindingRings } from "./BindingRings";
import { DocumentPage } from "./DocumentPage";
import { NotebookCoverShell } from "./NotebookCoverShell";
import { NotebookCoverTabs } from "./NotebookCoverTabs";

interface NotebookViewProps {
  document: MoctesDocument;
}

export function NotebookView({ document }: NotebookViewProps) {
  const pages = getOrderedPages(document);
  const activeIndex = Math.max(
    0,
    pages.findIndex((page) => page.id === document.activePageId),
  );
  const leftIndex = activeIndex % 2 === 0 ? activeIndex : activeIndex - 1;
  const leftPage = pages[leftIndex] ?? pages[0];
  const rightPage = pages[leftIndex + 1];
  const placeholderRightPage = {
    ...leftPage,
    id: "notebook-placeholder-right",
    title: "Página vazia",
    elements: [],
  };

  return (
    <article className="notebook-view" aria-label={document.title}>
      {document.dividers.map((divider) => (
        <div
          key={divider.id}
          className="notebook-divider-tab"
          style={{ backgroundColor: divider.color }}
          title={divider.name}
          aria-hidden="true"
        />
      ))}
      <NotebookCoverTabs side="left" position="top" color={document.leftTabColor ?? "rgba(72, 73, 79, 0.62)"} />
      <NotebookCoverTabs side="right" position="top" color={document.rightTabColor ?? "rgba(181, 222, 230, 0.76)"} />
      <NotebookCoverTabs side="left" position="bottom" color={document.leftTabColor ?? "rgba(72, 73, 79, 0.54)"} />
      <NotebookCoverTabs side="right" position="bottom" color={document.rightTabColor ?? "rgba(181, 222, 230, 0.64)"} />

      <NotebookCoverShell document={document}>
        <div className="notebook-spread">
          <DocumentPage
            page={leftPage}
            className="notebook-page notebook-page-left"
            label={leftPage.title ?? "Página esquerda"}
          />

          <div className="notebook-spine">
            <BindingRings />
          </div>

          <DocumentPage
            page={rightPage ?? placeholderRightPage}
            className="notebook-page notebook-page-right"
            label={rightPage?.title ?? "Página vazia"}
            interactive={Boolean(rightPage)}
          />
        </div>
      </NotebookCoverShell>
    </article>
  );
}
