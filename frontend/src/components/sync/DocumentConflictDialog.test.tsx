import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as documentPersistence from "../../services/documentPersistence";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useDocumentSyncStore } from "../../stores/useDocumentSyncStore";
import { resetStores } from "../../test/helpers/resetStores";
import { DocumentConflictDialog } from "./DocumentConflictDialog";

vi.mock("../../services/documentPersistence", async () => {
  const actual = await vi.importActual<
    typeof import("../../services/documentPersistence")
  >("../../services/documentPersistence");
  return {
    ...actual,
    loadDocumentConflictDetails: vi.fn(),
    resolveDocumentConflict: vi.fn(),
  };
});

const loadDocumentConflictDetails = vi.mocked(
  documentPersistence.loadDocumentConflictDetails,
);
const resolveDocumentConflict = vi.mocked(
  documentPersistence.resolveDocumentConflict,
);

describe("DocumentConflictDialog", () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  it("compara as versões e permite manter a alteração local", async () => {
    const localDocument = {
      ...useDocumentStore.getState().documents[0],
      title: "Minha versão",
    };
    const remoteDocument = {
      ...localDocument,
      title: "Versão do servidor",
    };
    loadDocumentConflictDetails.mockResolvedValue({
      ok: true,
      data: {
        documentId: localDocument.id,
        operationKind: "upsert",
        localDocument,
        remoteRecord: {
          id: localDocument.id,
          version: 8,
          collaborationSequence: 0,
          document: remoteDocument,
          createdAt: "2026-08-11T10:00:00.000Z",
          updatedAt: "2026-08-11T11:00:00.000Z",
        },
      },
    });
    resolveDocumentConflict.mockImplementation(async (documentId) => {
      useDocumentSyncStore.getState().dispatch({
        type: "CONFLICT_RESOLVED",
        documentId,
        pendingOperations: 0,
      });
      return { ok: true, data: null };
    });
    useDocumentSyncStore.getState().dispatch({
      type: "CONFLICT",
      documentId: localDocument.id,
      operationId: "operation-1",
      error: "Version conflict",
    });

    render(<DocumentConflictDialog />);

    expect(await screen.findByText("Minha versão")).toBeInTheDocument();
    expect(screen.getByText("Versão do servidor")).toBeInTheDocument();
    expect(screen.getByText(/Versão 8/)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Manter minha versão" }),
    );

    expect(resolveDocumentConflict).toHaveBeenCalledWith(
      localDocument.id,
      "local",
      "operation-1",
    );
    expect(
      screen.queryByRole("dialog", { name: "Escolha qual versão manter" }),
    ).not.toBeInTheDocument();
  });
});
