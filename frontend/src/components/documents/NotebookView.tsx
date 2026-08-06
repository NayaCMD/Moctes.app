import type { MoctesDocument } from "../../types/document.types";
import type { NotebookBinding } from "../../types/notebook.types";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { createDefaultNotebookCover } from "../../utils/notebookMigration.utils";
import {
  buildNotebookSurfaces,
  getActiveSectionId,
  getSurfaceById,
} from "../../utils/notebookSurfaces.utils";
import { BindingRings } from "./BindingRings";
import { NotebookCover } from "./NotebookCover";
import { NotebookNavigation } from "./NotebookNavigation";
import { NotebookSurfaceRenderer } from "./NotebookSurfaceRenderer";
import { NotebookTabs } from "./NotebookTabs";

interface NotebookViewProps {
  document: MoctesDocument;
}

export function NotebookView({ document }: NotebookViewProps) {
  const goToSection = useDocumentStore((state) => state.goToSection);
  const surfaces = buildNotebookSurfaces(document);
  const activeSurface =
    (document.activeSurfaceId
      ? getSurfaceById(document, document.activeSurfaceId)
      : undefined) ?? surfaces[0];
  const activeSectionId = getActiveSectionId(document, activeSurface);
  const cover = document.cover ?? createDefaultNotebookCover(document);
  const binding: NotebookBinding = document.binding ?? "left";

  return (
    <article
      className="notebook-view notebook-view-v2"
      data-binding={binding}
      aria-label={document.title}
    >
      <NotebookCover cover={cover} binding={binding} />
      <div className="notebook-binding" data-binding={binding}>
        <BindingRings
          orientation={binding === "top" ? "horizontal" : "vertical"}
          count={binding === "top" ? 8 : 7}
        />
      </div>
      <NotebookTabs
        sections={document.sections ?? []}
        activeSectionId={activeSectionId}
        onSelectSection={(sectionId) => goToSection(sectionId, document.id)}
      />
      <div className="notebook-stage">
        <div className="notebook-surface">
          <NotebookSurfaceRenderer document={document} activeSurface={activeSurface} />
        </div>
      </div>
      <NotebookNavigation document={document} activeSurface={activeSurface} />
    </article>
  );
}
