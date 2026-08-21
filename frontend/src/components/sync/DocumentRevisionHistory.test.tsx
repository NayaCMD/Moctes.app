import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as documentPersistence from "../../services/documentPersistence";
import * as documentRevisions from "../../services/documentRevisions";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { resetStores } from "../../test/helpers/resetStores";
import { DocumentRevisionHistory } from "./DocumentRevisionHistory";

vi.mock("../../services/documentRevisions", async () => {
  const actual = await vi.importActual<
    typeof import("../../services/documentRevisions")
  >("../../services/documentRevisions");
  return { ...actual, listDocumentRevisions: vi.fn() };
});

vi.mock("../../services/documentPersistence", async () => {
  const actual = await vi.importActual<
    typeof import("../../services/documentPersistence")
  >("../../services/documentPersistence");
  return { ...actual, restoreDocumentRevision: vi.fn() };
});

const listDocumentRevisions = vi.mocked(
  documentRevisions.listDocumentRevisions,
);
const restoreDocumentRevision = vi.mocked(
  documentPersistence.restoreDocumentRevision,
);

describe("DocumentRevisionHistory", () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  it("confirma uma restauração sem apagar a versão atual", async () => {
    const document = useDocumentStore.getState().documents[0];
    listDocumentRevisions.mockResolvedValue({
      ok: true,
      data: {
        documentId: document.id,
        currentVersion: 3,
        revisions: [
          revision(3, "Versão atual"),
          revision(2, "Antes da alteração"),
        ],
      },
    });
    restoreDocumentRevision.mockResolvedValue({
      ok: true,
      data: {
        id: document.id,
        version: 4,
        collaborationSequence: 0,
        document: { ...document, title: "Antes da alteração" },
        createdAt: "2026-08-11T10:00:00.000Z",
        updatedAt: "2026-08-11T12:00:00.000Z",
      },
    });

    render(
      <DocumentRevisionHistory
        canRestore
        documentId={document.id}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("Antes da alteração")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Restaurar esta versão" }),
    );
    expect(
      screen.getByText(/A versão atual será preservada no histórico\./),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Confirmar restauração" }),
    );

    expect(restoreDocumentRevision).toHaveBeenCalledWith(document.id, 2, 3);
  });

  it("mantém o histórico somente leitura para viewers", async () => {
    const document = useDocumentStore.getState().documents[0];
    listDocumentRevisions.mockResolvedValue({
      ok: true,
      data: {
        documentId: document.id,
        currentVersion: 2,
        revisions: [revision(2, "Atual"), revision(1, "Inicial")],
      },
    });

    render(
      <DocumentRevisionHistory
        canRestore={false}
        documentId={document.id}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("Inicial")).toBeInTheDocument();
    expect(
      screen.getByText(/permite consultar o histórico, mas não restaurar/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Restaurar esta versão" }),
    ).not.toBeInTheDocument();
  });
});

function revision(version: number, title: string) {
  return {
    id: `revision-${version}`,
    version,
    title,
    schemaVersion: 3,
    restoredFromVersion: null,
    createdAt: `2026-08-11T0${version}:00:00.000Z`,
    createdBy: { id: "user-1", name: "Ana" },
  };
}
