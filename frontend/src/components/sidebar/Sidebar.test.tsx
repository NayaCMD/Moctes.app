import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAssetLibraryStore } from "../../stores/useAssetLibraryStore";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { resetStores } from "../../test/helpers/resetStores";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  beforeEach(() => resetStores());

  function openNotebook() {
    useEditorStore.setState({
      notebookBook: { documentId: useDocumentStore.getState().documents[0].id, phase: "open" },
    });
  }

  it("renderiza sidebar simples com quatro secoes e biblioteca avancada fechada", () => {
    render(<Sidebar />);

    expect(screen.getByRole("heading", { name: "Stickers" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Imagens" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Post-its" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tapes" })).toBeInTheDocument();
    expect(screen.getByText("11 de 15 itens")).toBeInTheDocument();
    expect(screen.queryByText(/Asset indisponível/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Pasta ativa")).not.toBeInTheDocument();
    expect(screen.queryAllByText("Adicionar")).toHaveLength(0);
  });

  it("usa abas separadas para Biblioteca e Aparencia", async () => {
    render(<Sidebar />);

    expect(screen.getByRole("tab", { name: "Biblioteca" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("Capa")).not.toBeInTheDocument();
    expect(document.querySelector(".appearance-panel")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Aparência" }));

    expect(screen.getByRole("tabpanel", { name: "Aparência" })).toBeInTheDocument();
    expect(screen.getByText("Capa")).toBeInTheDocument();
    expect(screen.getByText("Lombada")).toBeInTheDocument();
  });

  it("abre biblioteca avancada com pastas, busca, filtros e importacao", async () => {
    render(<Sidebar />);

    await userEvent.click(screen.getByRole("button", { name: "Gerenciar biblioteca" }));

    expect(screen.getByRole("dialog", { name: "Gerenciar biblioteca" })).toBeInTheDocument();
    expect(screen.getByLabelText("Pasta ativa")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tapes" }));
    expect(useAssetLibraryStore.getState().activeTypeFilter).toBe("tape");
  });

  it("renderiza o gerenciador fora da sidebar e devolve o foco ao fechar", async () => {
    render(<Sidebar />);
    const manageButton = screen.getByRole("button", {
      name: "Gerenciar biblioteca",
    });

    await userEvent.click(manageButton);

    const dialog = screen.getByRole("dialog", { name: "Gerenciar biblioteca" });
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Fechar gerenciador de biblioteca",
        }),
      ).toHaveFocus(),
    );

    await userEvent.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: "Gerenciar biblioteca" }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(manageButton).toHaveFocus());
  });

  it("seleciona asset e adiciona por duplo clique", async () => {
    openNotebook();
    render(<Sidebar />);
    const before = useDocumentStore.getState().documents[0].pages[0].elements.length;

    const thumbnail = screen.getByRole("button", { name: "Selecionar Cartela Moctes" });
    await userEvent.click(thumbnail);
    expect(useAssetLibraryStore.getState().selectedAssetId).toBe("sticker-sheet");

    await userEvent.dblClick(thumbnail);
    const elements = useDocumentStore.getState().documents[0].pages[0].elements;
    expect(elements).toHaveLength(before + 1);
    expect(elements.at(-1)).toMatchObject({ type: "sticker" });
    expect(useDocumentStore.getState().selectedElementId).toBe(elements.at(-1)?.id);
    expect(screen.getByText("Asset adicionado à página.")).toBeInTheDocument();
  });

  it("nao adiciona asset quando a divisoria do caderno esta aberta", async () => {
    openNotebook();
    const document = useDocumentStore.getState().documents[0];
    const section = document.sections?.[0];
    if (!section) {
      throw new Error("Section not found");
    }
    useDocumentStore.getState().goToSection(section.id, document.id);
    render(<Sidebar />);
    const before = useDocumentStore.getState().documents[0].pages[0].elements.length;

    await userEvent.dblClick(screen.getByRole("button", { name: "Selecionar Cartela Moctes" }));

    expect(useDocumentStore.getState().documents[0].pages[0].elements).toHaveLength(before);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
  });

  it("nao adiciona asset por duplo clique durante a transicao do caderno", async () => {
    openNotebook();
    const document = useDocumentStore.getState().documents[0];
    const page = document.pages[0];
    useDocumentStore.getState().goToPage(page.id, document.id);
    useEditorStore.getState().beginNotebookTransition({
      documentId: document.id,
      fromSurfaceId: page.id,
      toSurfaceId: document.pages[1].id,
      direction: "forward",
      phase: "running",
    });
    render(<Sidebar />);
    const before = useDocumentStore.getState().documents[0].pages[0].elements.length;

    await userEvent.dblClick(screen.getByRole("button", { name: "Selecionar Cartela Moctes" }));

    expect(useDocumentStore.getState().documents[0].pages[0].elements).toHaveLength(before);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
  });

  it("Enter na miniatura adiciona uma unica vez", async () => {
    openNotebook();
    render(<Sidebar />);
    const thumbnail = screen.getByRole("button", { name: "Selecionar Tape azul" });
    const before = useDocumentStore.getState().documents[0].pages[0].elements.length;

    thumbnail.focus();
    await userEvent.keyboard("{Enter}");

    const elements = useDocumentStore.getState().documents[0].pages[0].elements;
    expect(elements).toHaveLength(before + 1);
    expect(elements.at(-1)?.type).toBe("tape");
  });

  it("busca exibe estado vazio quando nao encontra resultados", async () => {
    render(<Sidebar />);

    await userEvent.click(screen.getByRole("button", { name: "Gerenciar biblioteca" }));
    await userEvent.type(screen.getByLabelText("Buscar assets"), "nao existe");

    expect(screen.getByText("Nenhum asset encontrado.")).toBeInTheDocument();
  });

  it("abre modal de importacao", async () => {
    render(<Sidebar />);

    await userEvent.click(screen.getByRole("button", { name: "Gerenciar biblioteca" }));
    await userEvent.click(screen.getByRole("button", { name: "Importar asset" }));

    expect(screen.getByRole("dialog", { name: "Importar asset" })).toBeInTheDocument();
  });

  it("movimento abaixo do limiar nao inicia drag externo", () => {
    render(<Sidebar />);
    const thumbnail = screen.getByRole("button", { name: "Selecionar Cartela Moctes" });
    const before = useDocumentStore.getState().documents[0].pages[0].elements.length;

    fireEvent.pointerDown(thumbnail, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 12, clientY: 12 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 12, clientY: 12 });

    expect(useEditorStore.getState().assetDrag.status).toBe("idle");
    expect(useDocumentStore.getState().documents[0].pages[0].elements).toHaveLength(before);
  });

  it("drag valido cria um asset exatamente na pagina alvo", () => {
    openNotebook();
    render(<Sidebar />);
    const thumbnail = screen.getByRole("button", { name: "Selecionar Cartela Moctes" });
    const state = useDocumentStore.getState();
    const page = document.createElement("section");
    page.dataset.pageId = state.activePageId;
    page.dataset.documentId = state.activeDocumentId;
    page.getBoundingClientRect = () =>
      ({ left: 100, top: 50, width: 400, height: 500, right: 500, bottom: 550 }) as DOMRect;
    vi.spyOn(document, "elementFromPoint").mockReturnValue(page);
    const before = state.documents[0].pages[0].elements.length;

    fireEvent.pointerDown(thumbnail, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 280, clientY: 260 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 280, clientY: 260 });

    const elements = useDocumentStore.getState().documents[0].pages[0].elements;
    expect(elements).toHaveLength(before + 1);
    expect(elements.at(-1)).toMatchObject({ type: "sticker" });
    expect(useDocumentStore.getState().selectedElementId).toBe(elements.at(-1)?.id);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
    expect(useEditorStore.getState().assetDrag.status).toBe("idle");
  });

  it("drop valido nao insere asset durante a transicao do caderno", () => {
    openNotebook();
    render(<Sidebar />);
    const state = useDocumentStore.getState();
    const page = state.documents[0].pages[0];
    const thumbnail = screen.getByRole("button", { name: "Selecionar Cartela Moctes" });
    const pageElement = document.createElement("section");
    pageElement.dataset.pageId = page.id;
    pageElement.dataset.documentId = state.activeDocumentId;
    pageElement.getBoundingClientRect = () =>
      ({ left: 100, top: 50, width: 400, height: 500, right: 500, bottom: 550 }) as DOMRect;
    vi.spyOn(document, "elementFromPoint").mockReturnValue(pageElement);
    useEditorStore.getState().beginNotebookTransition({
      documentId: state.documents[0].id,
      fromSurfaceId: page.id,
      toSurfaceId: state.documents[0].pages[1].id,
      direction: "forward",
      phase: "running",
    });
    const before = page.elements.length;

    fireEvent.pointerDown(thumbnail, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 280, clientY: 260 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 280, clientY: 260 });

    expect(useDocumentStore.getState().documents[0].pages[0].elements).toHaveLength(before);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
    expect(useEditorStore.getState().assetDrag.status).toBe("idle");
  });

  it("drop invalido cancela sem criar elemento nem historico", () => {
    render(<Sidebar />);
    const thumbnail = screen.getByRole("button", { name: "Selecionar Tape azul" });
    vi.spyOn(document, "elementFromPoint").mockReturnValue(document.createElement("div"));
    const before = useDocumentStore.getState().documents[0].pages[0].elements.length;

    fireEvent.pointerDown(thumbnail, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 280, clientY: 260 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 280, clientY: 260 });

    expect(useDocumentStore.getState().documents[0].pages[0].elements).toHaveLength(before);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
    expect(useEditorStore.getState().assetDrag.status).toBe("idle");
  });
});
