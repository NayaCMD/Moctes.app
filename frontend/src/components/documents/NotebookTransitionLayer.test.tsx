import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { resetStores } from "../../test/helpers/resetStores";
import type { MoctesDocument } from "../../types/document.types";
import type { NotebookTransitionState } from "../../types/notebook.types";
import { buildNotebookSurfaces } from "../../utils/notebookSurfaces.utils";
import { NotebookTransitionLayer } from "./NotebookTransitionLayer";

function getNotebook(): MoctesDocument {
  const document = useDocumentStore
    .getState()
    .documents.find((item) => item.type === "notebook");

  if (!document) {
    throw new Error("Notebook document not found");
  }

  return document;
}

function transition(
  document: MoctesDocument,
  fromSurfaceId: string,
  toSurfaceId: string,
  direction: "forward" | "backward",
): NotebookTransitionState {
  return {
    documentId: document.id,
    fromSurfaceId,
    toSurfaceId,
    direction,
    phase: "running",
  };
}

describe("NotebookTransitionLayer", () => {
  beforeEach(() => resetStores());

  it("forward renderiza destino como base e origem como folha", () => {
    const notebookDocument = getNotebook();
    const surfaces = buildNotebookSurfaces(notebookDocument);

    render(
      <NotebookTransitionLayer
        document={notebookDocument}
        activeSurface={surfaces[0]}
        binding="left"
        transition={transition(notebookDocument, surfaces[0].id, surfaces[1].id, "forward")}
        onTransitionComplete={() => undefined}
      />,
    );

    expect(document.querySelector(".notebook-surface-base [data-page-id]")).toHaveAttribute(
      "data-page-id",
      surfaces[1].id,
    );
    expect(document.querySelector(".notebook-leaf")).toHaveAttribute("data-direction", "forward");
    expect(document.querySelector(".notebook-leaf .notebook-divider-surface")).toBeInTheDocument();
  });

  it("backward renderiza origem como base e destino como folha", () => {
    const notebookDocument = getNotebook();
    const surfaces = buildNotebookSurfaces(notebookDocument);

    render(
      <NotebookTransitionLayer
        document={notebookDocument}
        activeSurface={surfaces[1]}
        binding="top"
        transition={transition(notebookDocument, surfaces[1].id, surfaces[0].id, "backward")}
        onTransitionComplete={() => undefined}
      />,
    );

    expect(document.querySelector(".notebook-surface-base [data-page-id]")).toHaveAttribute(
      "data-page-id",
      surfaces[1].id,
    );
    expect(document.querySelector(".notebook-leaf")).toHaveAttribute("data-binding", "top");
    expect(document.querySelector(".notebook-leaf")).toHaveAttribute("data-direction", "backward");
  });

  it("nao duplica a mesma DocumentPage durante page-to-page", () => {
    const notebookDocument = getNotebook();
    const surfaces = buildNotebookSurfaces(notebookDocument);
    const firstPage = surfaces.find((surface) => surface.kind === "page");
    const secondPage = surfaces.find(
      (surface) => surface.kind === "page" && surface.id !== firstPage?.id,
    );

    if (!firstPage || !secondPage) {
      throw new Error("Two pages are required");
    }

    render(
      <NotebookTransitionLayer
        document={notebookDocument}
        activeSurface={firstPage}
        binding="left"
        transition={transition(notebookDocument, firstPage.id, secondPage.id, "forward")}
        onTransitionComplete={() => undefined}
      />,
    );

    expect(document.querySelectorAll(`[data-page-id="${firstPage.id}"]`)).toHaveLength(1);
    expect(document.querySelectorAll(`[data-page-id="${secondPage.id}"]`)).toHaveLength(1);
  });

  it("transitionend conclui a animacao e cancela o fallback externo", () => {
    const onTransitionComplete = vi.fn();
    const notebookDocument = getNotebook();
    const surfaces = buildNotebookSurfaces(notebookDocument);

    render(
      <NotebookTransitionLayer
        document={notebookDocument}
        activeSurface={surfaces[0]}
        binding="left"
        transition={transition(notebookDocument, surfaces[0].id, surfaces[1].id, "forward")}
        onTransitionComplete={onTransitionComplete}
      />,
    );

    const leaf = document.querySelector(".notebook-leaf");
    if (!leaf) {
      throw new Error("Notebook leaf not found");
    }

    fireEvent.transitionEnd(leaf, { propertyName: "opacity" });
    expect(onTransitionComplete).not.toHaveBeenCalled();

    fireEvent.transitionEnd(leaf, { propertyName: "transform" });
    expect(onTransitionComplete).toHaveBeenCalledTimes(1);
  });
});
