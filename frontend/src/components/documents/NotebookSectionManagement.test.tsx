import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { resetStores } from "../../test/helpers/resetStores";
import type { MoctesDocument } from "../../types/document.types";
import { getSectionByPageId } from "../../utils/notebookSurfaces.utils";
import { NotebookView } from "./NotebookView";
import { NotepadView } from "./NotepadView";

function getNotebookDocument(): MoctesDocument {
  const document = useDocumentStore
    .getState()
    .documents.find((item) => item.type === "notebook");

  if (!document) {
    throw new Error("Notebook document not found");
  }

  return document;
}

function NotebookHarness() {
  const document = useDocumentStore((state) =>
    state.documents.find((item) => item.type === "notebook"),
  );

  return document ? <NotebookView document={document} /> : null;
}

function mockTabLayout() {
  const tabs = document.querySelector<HTMLElement>(".notebook-tabs");
  const tab = screen.getByRole("button", { name: "Abrir divisória July" });

  if (!tabs) {
    throw new Error("Notebook tabs not found");
  }

  tabs.getBoundingClientRect = vi.fn(() => ({
    x: 100,
    y: 0,
    width: 500,
    height: 34,
    top: 0,
    right: 600,
    bottom: 34,
    left: 100,
    toJSON: () => undefined,
  }));
  tab.getBoundingClientRect = vi.fn(() => ({
    x: 100,
    y: 8,
    width: 106,
    height: 24,
    top: 8,
    right: 206,
    bottom: 32,
    left: 100,
    toJSON: () => undefined,
  }));
  tab.setPointerCapture = vi.fn();

  return tab;
}

async function openSectionMenu(sectionTitle: string) {
  await userEvent.click(screen.getByRole("button", { name: `Ações da seção ${sectionTitle}` }));
}

describe("Notebook section management", () => {
  beforeEach(() => {
    resetStores();
    useEditorStore.setState({
      notebookBook: { documentId: getNotebookDocument().id, phase: "open" },
    });
  });

  it("adiciona seção com primeira folha e abre a nova divisória sem page flip", async () => {
    const user = userEvent.setup();
    render(<NotebookHarness />);

    expect(screen.getByRole("button", { name: "Adicionar seção" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Adicionar seção" }));
    await user.type(screen.getByLabelText("Título"), "Matemática");
    fireEvent.change(screen.getByLabelText("Cor da divisória"), { target: { value: "#ffccdd" } });
    await user.click(screen.getByRole("button", { name: "Criar seção" }));

    const document = getNotebookDocument();
    const section = document.sections?.find((item) => item.title === "Matemática");
    expect(section).toBeDefined();
    expect(section?.pages).toHaveLength(1);
    expect(section?.divider.color).toBe("#ffccdd");
    expect(document.activeSurfaceId).toBe(section?.divider.id);
    expect(globalThis.document.querySelector(".notebook-leaf")).not.toBeInTheDocument();
  });

  it("renomeia seção com Enter, rejeita título vazio e cancela com Escape", async () => {
    const user = userEvent.setup();
    render(<NotebookHarness />);

    await openSectionMenu("July");
    await user.click(screen.getByRole("menuitem", { name: "Renomear" }));
    expect(screen.getByLabelText("Título")).toHaveValue("July");
    await user.clear(screen.getByLabelText("Título"));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe um título");

    await user.type(screen.getByLabelText("Título"), "Front-end{Enter}");
    expect(getNotebookDocument().sections?.[0].title).toBe("Front-end");

    await openSectionMenu("Front-end");
    await user.click(screen.getByRole("menuitem", { name: "Renomear" }));
    await user.clear(screen.getByLabelText("Título"));
    await user.type(screen.getByLabelText("Título"), "Cancelada");
    fireEvent.keyDown(window, { key: "Escape" });

    expect(getNotebookDocument().sections?.[0].title).toBe("Front-end");
  });

  it("personaliza divisória com uma confirmação única", async () => {
    const user = userEvent.setup();
    render(<NotebookHarness />);

    await openSectionMenu("July");
    await user.click(screen.getByRole("menuitem", { name: "Personalizar divisória" }));
    fireEvent.change(screen.getByLabelText("Cor da divisória"), { target: { value: "#123456" } });
    fireEvent.change(screen.getByLabelText("Cor da aba"), { target: { value: "#abcdef" } });
    fireEvent.change(screen.getByLabelText("Cor do texto"), { target: { value: "#111111" } });
    fireEvent.change(screen.getByLabelText("Posição da aba"), { target: { value: "42" } });
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    const divider = getNotebookDocument().sections?.[0].divider;
    expect(divider).toMatchObject({
      color: "#123456",
      tabColor: "#abcdef",
      textColor: "#111111",
      tabPosition: 42,
    });
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
  });

  it("tabPosition posiciona a aba e drag horizontal persiste uma vez", () => {
    render(<NotebookHarness />);
    const tab = mockTabLayout();
    const shell = tab.closest<HTMLElement>(".notebook-tab-shell");

    expect(shell).toHaveStyle({ "--notebook-tab-position": "0%" });

    useEditorStore.setState({ undoStack: [] });
    fireEvent.pointerDown(tab, { pointerId: 1, button: 0, clientX: 130, clientY: 12 });
    fireEvent.pointerMove(tab, { pointerId: 1, clientX: 330, clientY: 34 });
    expect(shell).toHaveStyle({ "--notebook-tab-position": "40%" });
    fireEvent.pointerUp(tab, { pointerId: 1, clientX: 330, clientY: 80 });

    expect(getNotebookDocument().sections?.[0].divider.tabPosition).toBe(40);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
  });

  it("drag vertical nao altera a posicao da aba", () => {
    render(<NotebookHarness />);
    const tab = mockTabLayout();

    useEditorStore.setState({ undoStack: [] });
    fireEvent.pointerDown(tab, { pointerId: 1, button: 0, clientX: 130, clientY: 12 });
    fireEvent.pointerMove(tab, { pointerId: 1, clientX: 130, clientY: 80 });
    fireEvent.pointerUp(tab, { pointerId: 1, clientX: 130, clientY: 80 });

    expect(getNotebookDocument().sections?.[0].divider.tabPosition).toBe(0);
    expect(useEditorStore.getState().undoStack).toHaveLength(0);
  });

  it("movimento pequeno continua sendo clique e menu não inicia drag", async () => {
    const user = userEvent.setup();
    render(<NotebookHarness />);
    const tab = mockTabLayout();
    const activePageId = getNotebookDocument().activePageId;

    fireEvent.pointerDown(tab, { pointerId: 1, button: 0, clientX: 130, clientY: 12 });
    fireEvent.pointerMove(tab, { pointerId: 1, clientX: 132, clientY: 13 });
    fireEvent.pointerUp(tab, { pointerId: 1, clientX: 132, clientY: 13 });
    fireEvent.click(tab);

    const leaf = globalThis.document.querySelector(".notebook-leaf");
    expect(leaf).toBeInTheDocument();
    if (!leaf) {
      throw new Error("Notebook leaf not found");
    }
    fireEvent.transitionEnd(leaf, { propertyName: "transform" });

    expect(getNotebookDocument().activeSurfaceId).toBe(getNotebookDocument().sections?.[0].divider.id);
    expect(getNotebookDocument().activePageId).toBe(activePageId);

    await user.click(screen.getByRole("button", { name: "Ações da seção July" }));
    expect(screen.getByRole("menuitem", { name: "Renomear" })).toBeInTheDocument();
    expect(getNotebookDocument().sections?.[0].divider.tabPosition).toBe(0);
  });

  it("posição da aba é clamped e teclado reposiciona com Alt+seta", () => {
    render(<NotebookHarness />);
    const tab = mockTabLayout();

    useEditorStore.setState({ undoStack: [] });
    fireEvent.keyDown(tab, { key: "ArrowRight", altKey: true, shiftKey: true });
    expect(getNotebookDocument().sections?.[0].divider.tabPosition).toBe(12);

    fireEvent.pointerDown(tab, { pointerId: 1, button: 0, clientX: 130, clientY: 12 });
    fireEvent.pointerMove(tab, { pointerId: 1, clientX: 900, clientY: 12 });
    fireEvent.pointerUp(tab, { pointerId: 1, clientX: 900, clientY: 12 });
    expect(getNotebookDocument().sections?.[0].divider.tabPosition).toBe(84);
  });

  it("closed e transição bloqueiam drag da aba", () => {
    useEditorStore.setState({
      notebookBook: { documentId: getNotebookDocument().id, phase: "closed" },
    });
    const { rerender } = render(<NotebookHarness />);
    let tab = mockTabLayout();

    fireEvent.pointerDown(tab, { pointerId: 1, button: 0, clientX: 130, clientY: 12 });
    fireEvent.pointerMove(tab, { pointerId: 1, clientX: 330, clientY: 12 });
    fireEvent.pointerUp(tab, { pointerId: 1, clientX: 330, clientY: 12 });
    expect(getNotebookDocument().sections?.[0].divider.tabPosition).toBe(0);

    useEditorStore.setState({
      notebookBook: { documentId: getNotebookDocument().id, phase: "open" },
    });
    const document = getNotebookDocument();
    const section = document.sections?.[0];
    if (!section) {
      throw new Error("Section not found");
    }
    useEditorStore.getState().beginNotebookTransition({
      documentId: document.id,
      fromSurfaceId: section.divider.id,
      toSurfaceId: section.pages[0].id,
      direction: "forward",
      phase: "running",
    });
    rerender(<NotebookHarness />);
    tab = mockTabLayout();
    fireEvent.pointerDown(tab, { pointerId: 1, button: 0, clientX: 130, clientY: 12 });
    fireEvent.pointerMove(tab, { pointerId: 1, clientX: 330, clientY: 12 });
    fireEvent.pointerUp(tab, { pointerId: 1, clientX: 330, clientY: 12 });
    expect(getNotebookDocument().sections?.[0].divider.tabPosition).toBe(0);
  });

  it("undo restaura posição anterior da aba", () => {
    render(<NotebookHarness />);
    const tab = mockTabLayout();
    useEditorStore.setState({ undoStack: [], redoStack: [] });

    fireEvent.pointerDown(tab, { pointerId: 1, button: 0, clientX: 130, clientY: 12 });
    fireEvent.pointerMove(tab, { pointerId: 1, clientX: 330, clientY: 12 });
    fireEvent.pointerUp(tab, { pointerId: 1, clientX: 330, clientY: 12 });
    expect(getNotebookDocument().sections?.[0].divider.tabPosition).toBe(40);

    const previousDocuments = useEditorStore.getState().undo(useDocumentStore.getState().documents);
    if (previousDocuments) {
      useDocumentStore.getState().applyDocumentsSnapshot(previousDocuments);
    }
    expect(getNotebookDocument().sections?.[0].divider.tabPosition).toBe(0);
  });

  it("reordena seções por botões e desabilita limites", async () => {
    const user = userEvent.setup();
    const documentId = getNotebookDocument().id;
    useDocumentStore.getState().addSection(documentId, { title: "Back-end" });
    useEditorStore.setState({ undoStack: [] });
    render(<NotebookHarness />);

    await openSectionMenu("July");
    expect(screen.getByRole("menuitem", { name: "Mover para a esquerda" })).toBeDisabled();
    fireEvent.keyDown(window, { key: "Escape" });

    await openSectionMenu("Back-end");
    expect(screen.getByRole("menuitem", { name: "Mover para a direita" })).toBeDisabled();
    await user.click(screen.getByRole("menuitem", { name: "Mover para a esquerda" }));

    expect(getNotebookDocument().sections?.map((section) => section.title)).toEqual([
      "Back-end",
      "July",
    ]);
    expect(useEditorStore.getState().undoStack).toHaveLength(1);
  });

  it("exclui seção sem folhas por fluxo simples e impede remover a última seção", async () => {
    const user = userEvent.setup();
    const documentId = getNotebookDocument().id;
    useDocumentStore.getState().addSection(documentId, {
      title: "Arquivo",
      createInitialPage: false,
    });
    render(<NotebookHarness />);

    await openSectionMenu("Arquivo");
    await user.click(screen.getByRole("menuitem", { name: "Excluir seção" }));
    await user.click(screen.getByRole("button", { name: "Excluir seção" }));
    expect(getNotebookDocument().sections?.some((section) => section.title === "Arquivo")).toBe(false);

    await openSectionMenu("July");
    await user.click(screen.getByRole("menuitem", { name: "Excluir seção" }));
    expect(screen.getByText(/precisa manter ao menos uma seção/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir seção" })).toBeDisabled();
  });

  it("exclui seção com folhas usando apagar ou mover para outra seção", async () => {
    const user = userEvent.setup();
    const documentId = getNotebookDocument().id;
    useDocumentStore.getState().addSection(documentId, { title: "Banco" });
    useDocumentStore.getState().addSection(documentId, { title: "UI" });
    render(<NotebookHarness />);

    await openSectionMenu("Banco");
    await user.click(screen.getByRole("menuitem", { name: "Excluir seção" }));
    expect(screen.getByLabelText("Seção de destino")).not.toHaveTextContent("Banco");
    await user.click(screen.getByLabelText("Excluir a seção e suas folhas"));
    await user.click(screen.getByRole("button", { name: "Excluir seção" }));
    expect(getNotebookDocument().sections?.some((section) => section.title === "Banco")).toBe(false);

    await openSectionMenu("UI");
    await user.click(screen.getByRole("menuitem", { name: "Excluir seção" }));
    await user.click(screen.getByLabelText("Mover folhas para outra seção"));
    await user.selectOptions(screen.getByLabelText("Seção de destino"), getNotebookDocument().sections?.[0].id ?? "");
    const movingPageIds = getNotebookDocument()
      .sections?.find((section) => section.title === "UI")
      ?.pages.map((page) => page.id) ?? [];
    await user.click(screen.getByRole("button", { name: "Excluir seção" }));

    const updatedDocument = getNotebookDocument();
    expect(updatedDocument.sections?.some((section) => section.title === "UI")).toBe(false);
    expect(
      movingPageIds.every((pageId) => updatedDocument.pages.some((page) => page.id === pageId)),
    ).toBe(true);
  });

  it("adiciona folha à seção ativa e move folha preservando activeSurfaceId", async () => {
    const user = userEvent.setup();
    const documentId = getNotebookDocument().id;
    const targetSectionId = useDocumentStore.getState().addSection(documentId, {
      title: "Destino",
      createInitialPage: false,
    });
    const firstSectionId = getNotebookDocument().sections?.[0].id;
    if (!targetSectionId || !firstSectionId) {
      throw new Error("Expected notebook sections");
    }
    useEditorStore.setState({ undoStack: [] });
    useDocumentStore.getState().goToSection(firstSectionId, documentId);
    render(<NotebookHarness />);

    await user.click(screen.getByRole("button", { name: "Adicionar folha à seção" }));
    const newPageId = getNotebookDocument().activeSurfaceId;
    if (!newPageId) {
      throw new Error("Expected active page surface");
    }
    expect(getSectionByPageId(getNotebookDocument(), newPageId)?.id).toBe(firstSectionId);

    await user.click(screen.getByRole("button", { name: "Mover folha para seção" }));
    expect(screen.getByRole("menuitemradio", { name: "July" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("menuitemradio", { name: "Destino" }));

    const updatedDocument = getNotebookDocument();
    expect(updatedDocument.activeSurfaceId).toBe(newPageId);
    expect(getSectionByPageId(updatedDocument, newPageId)?.id).toBe(targetSectionId);
    expect(useEditorStore.getState().undoStack.length).toBeGreaterThanOrEqual(2);
  });

  it("não mostra mover folha em divisória e desabilita menus durante transição", () => {
    const document = getNotebookDocument();
    const section = document.sections?.[0];
    if (!section) {
      throw new Error("Section not found");
    }
    useDocumentStore.getState().goToSection(section.id, document.id);
    useEditorStore.getState().beginNotebookTransition({
      documentId: document.id,
      fromSurfaceId: section.divider.id,
      toSurfaceId: section.pages[0].id,
      direction: "forward",
      phase: "running",
    });

    render(<NotebookHarness />);

    expect(screen.queryByRole("button", { name: "Mover folha para seção" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar seção" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ações da seção July" })).toBeDisabled();
  });

  it("notepad não recebe controles de seção", () => {
    const notepad = useDocumentStore
      .getState()
      .documents.find((item) => item.type === "notepad");
    if (!notepad) {
      throw new Error("Notepad not found");
    }

    render(<NotepadView document={notepad} />);

    expect(screen.queryByRole("button", { name: "Adicionar seção" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Seções do caderno" })).not.toBeInTheDocument();
  });
});
