import type { MoctesDocument } from "../../types/document.types";
import type { NotebookSurface } from "../../types/notebook.types";
import { getPagesInSection } from "../../utils/notebookSurfaces.utils";
import { DocumentPage } from "./DocumentPage";
import { NotebookDivider } from "./NotebookDivider";

interface NotebookSurfaceRendererProps {
  document: MoctesDocument;
  activeSurface: NotebookSurface | undefined;
  interactive?: boolean;
}

export function NotebookSurfaceRenderer({
  document,
  activeSurface,
  interactive = true,
}: NotebookSurfaceRendererProps) {
  if (!activeSurface) {
    return (
      <section className="notebook-empty-surface" aria-label="Caderno sem superfície">
        <p>Nenhuma superfície disponível.</p>
      </section>
    );
  }

  if (activeSurface.kind === "divider") {
    const section = document.sections?.find((item) => item.id === activeSurface.sectionId);

    if (!section) {
      return (
        <section className="notebook-empty-surface" aria-label="Divisória indisponível">
          <p>Divisória indisponível.</p>
        </section>
      );
    }

    return (
      <NotebookDivider
        section={section}
        pageCount={getPagesInSection(document, section.id).length}
        isActive={document.activeSurfaceId === activeSurface.id}
      />
    );
  }

  const page = document.pages.find((item) => item.id === activeSurface.id);

  if (!page) {
    return (
      <section className="notebook-empty-surface" aria-label="Página indisponível">
        <p>Página indisponível.</p>
      </section>
    );
  }

  return (
    <DocumentPage
      page={page}
      className="notebook-single-page"
      label={page.title || "Página do caderno"}
      interactive={interactive}
    />
  );
}
