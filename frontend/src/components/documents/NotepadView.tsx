import type { MoctesDocument } from "../../types/document.types";
import { getActivePage } from "../../utils/document.utils";
import { BindingRings } from "./BindingRings";
import { DocumentPage } from "./DocumentPage";

interface NotepadViewProps {
  document: MoctesDocument;
}

export function NotepadView({ document }: NotepadViewProps) {
  const page = getActivePage(document) ?? document.pages[0];

  return (
    <article className="notepad-view" aria-label={document.title}>
      <BindingRings count={5} orientation="horizontal" />

      <div className="notepad-board" style={{ backgroundColor: document.coverColor }}>
        <DocumentPage
          page={page}
          className="notepad-paper"
          label={page.title ?? "Folha do bloco de notas"}
        />
      </div>
    </article>
  );
}
