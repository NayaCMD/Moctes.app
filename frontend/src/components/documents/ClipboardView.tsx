import type { MoctesDocument } from "../../types/document.types";
import { getActivePage } from "../../utils/document.utils";
import { DocumentPage } from "./DocumentPage";

interface ClipboardViewProps {
  document: MoctesDocument;
}

function ClipboardClip() {
  return (
    <div className="clipboard-clip" aria-hidden="true">
      <span className="clipboard-clip-hole" />
      <span className="clipboard-clip-bar" />
      <span className="clipboard-clip-screw clipboard-clip-screw-left" />
      <span className="clipboard-clip-screw clipboard-clip-screw-right" />
    </div>
  );
}

export function ClipboardView({ document }: ClipboardViewProps) {
  const page = getActivePage(document) ?? document.pages[0];

  return (
    <article className="clipboard-view" aria-label={document.title}>
      <ClipboardClip />

      <div
        className="clipboard-board"
        style={{ background: document.clipboardColor ?? document.coverColor }}
      >
        <DocumentPage
          page={page}
          className="clipboard-paper"
          label={page.title ?? "Página da prancheta"}
        />
      </div>
    </article>
  );
}
