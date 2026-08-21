import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../stores/useAppStore";
import { useAuthStore } from "../../stores/useAuthStore";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { resetStores } from "../../test/helpers/resetStores";
import { ProductArea } from "./ProductArea";
import * as documentPersistence from "../../services/documentPersistence";

vi.mock("../../services/documentPersistence", async () => {
  const actual = await vi.importActual<
    typeof import("../../services/documentPersistence")
  >("../../services/documentPersistence");
  return {
    ...actual,
    loadDeletedDocuments: vi.fn(),
    restoreDeletedDocument: vi.fn(),
  };
});

const loadDeletedDocuments = vi.mocked(
  documentPersistence.loadDeletedDocuments,
);
const restoreDeletedDocument = vi.mocked(
  documentPersistence.restoreDeletedDocument,
);

describe("ProductArea", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
    useAuthStore.setState({
      phase: "authenticated",
      sessionMode: "online",
      user: {
        id: "test-user",
        name: "Pessoa de Teste",
        email: "teste@moctes.local",
      },
      workspaces: [
        {
          id: "test-workspace",
          name: "Espaço de Teste",
          slug: "test-workspace",
          role: "OWNER",
        },
      ],
      activeWorkspaceId: "test-workspace",
      error: null,
    });
  });

  it("lista, busca e abre documentos pelo hub", () => {
    useAppStore.setState({ activeTopTab: "files" });
    render(<ProductArea area="files" />);

    const firstDocument = useDocumentStore.getState().documents[0];
    expect(screen.getByText(firstDocument.title)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Buscar por título..."), {
      target: { value: "título que não existe" },
    });
    expect(screen.getByText("Nenhum resultado")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Buscar por título..."), {
      target: { value: firstDocument.title },
    });
    const openButton = screen.getByText(firstDocument.title).closest("button");
    if (!openButton) throw new Error("Document card action was not found.");
    fireEvent.click(openButton);
    expect(useAppStore.getState().activeTopTab).toBe("current-note");
    expect(useDocumentStore.getState().activeDocumentId).toBe(firstDocument.id);
  });

  it("cria um documento pelo tipo escolhido", () => {
    const before = useDocumentStore.getState().documents.length;
    render(<ProductArea area="files" />);

    fireEvent.click(screen.getByRole("button", { name: "Novo documento" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Caderno.*Páginas em seções/i }),
    );

    expect(useDocumentStore.getState().documents).toHaveLength(before + 1);
    expect(useAppStore.getState().activeTopTab).toBe("current-note");
  });

  it("remove ações mutáveis para quem possui acesso somente leitura", () => {
    useAuthStore.setState((state) => ({
      workspaces: state.workspaces.map((workspace) => ({
        ...workspace,
        role: "VIEWER" as const,
      })),
    }));
    render(<ProductArea area="files" />);

    expect(
      screen.queryByRole("button", { name: "Novo documento" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Excluir / }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Renomear" }),
    ).not.toBeInTheDocument();
  });

  it("lista e restaura documentos da lixeira", async () => {
    const deletedDocument = {
      ...structuredClone(useDocumentStore.getState().documents[0]),
      id: "deleted-document",
      title: "Caderno recuperável",
    };
    deletedDocument.pages = deletedDocument.pages.map((page) => ({
      ...page,
      documentId: deletedDocument.id,
    }));
    loadDeletedDocuments.mockResolvedValue({
      ok: true,
      data: [
        {
          id: deletedDocument.id,
          version: 2,
          collaborationSequence: 0,
          document: deletedDocument,
          createdAt: "2026-08-20T10:00:00.000Z",
          updatedAt: "2026-08-20T11:00:00.000Z",
          deletedAt: "2026-08-20T12:00:00.000Z",
        },
      ],
    });
    restoreDeletedDocument.mockResolvedValue({
      ok: true,
      data: {
        id: deletedDocument.id,
        version: 2,
        collaborationSequence: 0,
        document: deletedDocument,
        createdAt: "2026-08-20T10:00:00.000Z",
        updatedAt: "2026-08-20T12:00:00.000Z",
        deletedAt: null,
      },
    });
    render(<ProductArea area="files" />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir lixeira" }));
    expect(await screen.findByText("Caderno recuperável")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));

    await waitFor(() =>
      expect(screen.queryByText("Caderno recuperável")).not.toBeInTheDocument(),
    );
    expect(restoreDeletedDocument).toHaveBeenCalledWith(
      "test-workspace",
      "deleted-document",
    );
  });
});
