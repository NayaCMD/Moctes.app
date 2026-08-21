import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../../stores/useAppStore";
import { useAuthStore } from "../../stores/useAuthStore";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useDocumentSyncStore } from "../../stores/useDocumentSyncStore";
import { resetStores } from "../../test/helpers/resetStores";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  beforeEach(() => {
    resetStores();
    useAuthStore.setState({
      phase: "authenticated",
      user: { id: "user-1", name: "Usuario de Teste", email: "teste@moctes.local" },
      workspaces: [
        { id: "workspace-1", name: "Workspace de Teste", slug: "teste", role: "OWNER" },
      ],
      activeWorkspaceId: "workspace-1",
      error: null,
    });
    useDocumentSyncStore.setState({ phase: "synced", pendingOperations: 0 });
  });

  it("organiza contexto, sincronização e conta em um único cabeçalho", () => {
    render(<AppHeader />);

    expect(screen.getByLabelText("Cabeçalho do Moctes")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Tipo de documento" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Salvo");

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu do usuário" }));
    expect(screen.getByText("teste@moctes.local")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Histórico de versões" })).toBeInTheDocument();
  });

  it("troca o contexto principal sem alterar o formato do documento", () => {
    render(<AppHeader />);
    const notepad = useDocumentStore.getState().documents.find((document) => document.type === "notepad");

    fireEvent.click(screen.getByRole("button", { name: "Bloco de Notas" }));

    expect(useDocumentStore.getState().activeDocumentId).toBe(notepad?.id);
    expect(useAppStore.getState().activeDocumentType).toBe("notepad");
  });

  it("mantém a navegação secundária em um menu compacto", () => {
    render(<AppHeader />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir navegação" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Arquivos/ }));

    expect(useAppStore.getState().activeTopTab).toBe("files");
  });
});
