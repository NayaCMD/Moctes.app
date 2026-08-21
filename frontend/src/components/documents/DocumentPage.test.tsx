import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAppStore } from "../../stores/useAppStore";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { resetStores } from "../../test/helpers/resetStores";
import { DocumentPage } from "./DocumentPage";

function activePage() {
  const page = useDocumentStore
    .getState()
    .documents.flatMap((document) => document.pages)
    .find((item) => item.id === useDocumentStore.getState().activePageId);
  if (!page) {
    throw new Error("Active page not found");
  }
  return page;
}

function mockPaperRect() {
  const page = document.querySelector<HTMLElement>(".paper-surface");
  if (!page) {
    throw new Error("Paper surface not found");
  }
  page.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 400, height: 500, right: 400, bottom: 500 }) as DOMRect;
  return page;
}

describe("DocumentPage", () => {
  beforeEach(() => resetStores());

  it("nao cria texto em um clique solto com o editor em modo de selecao", () => {
    const page = activePage();
    render(<DocumentPage page={page} className="test-page" label="Pagina teste" />);
    const paper = mockPaperRect();
    const before = useDocumentStore.getState().documents[0].pages[0].elements.length;

    fireEvent.click(paper, { clientX: 320, clientY: 250 });

    expect(useDocumentStore.getState().documents[0].pages[0].elements).toHaveLength(before);
    expect(useDocumentStore.getState().selectedElementId).toBeNull();
  });

  it("cria um unico texto depois que a ferramenta de texto e selecionada", () => {
    useEditorStore.getState().setEditorMode("text");
    const page = activePage();
    render(<DocumentPage page={page} className="test-page" label="Pagina teste" />);
    const paper = mockPaperRect();
    const before = useDocumentStore.getState().documents[0].pages[0].elements.length;

    fireEvent.click(paper, { clientX: 320, clientY: 250 });

    const state = useDocumentStore.getState();
    const afterElements = state.documents[0].pages[0].elements;
    expect(afterElements).toHaveLength(before + 1);
    expect(afterElements.at(-1)).toMatchObject({
      id: state.selectedElementId,
      type: "text",
      content: { kind: "text", text: "Digite aqui" },
    });
    expect(useEditorStore.getState().editorMode).toBe("select");
  });

  it("cria e abre uma checklist depois que a ferramenta e selecionada", () => {
    useEditorStore.getState().setEditorMode("checklist");
    const page = activePage();
    render(<DocumentPage page={page} className="test-page" label="Pagina teste" />);
    const paper = mockPaperRect();
    const before = useDocumentStore.getState().documents[0].pages[0].elements.length;

    fireEvent.click(paper, { clientX: 280, clientY: 220 });

    const state = useDocumentStore.getState();
    const checklist = state.documents[0].pages[0].elements.at(-1);
    expect(state.documents[0].pages[0].elements).toHaveLength(before + 1);
    expect(checklist).toMatchObject({
      id: state.selectedElementId,
      type: "checklist",
      content: { kind: "checklist", title: "Lista de tarefas" },
    });
    expect(useEditorStore.getState().editorMode).toBe("select");
    expect(useEditorStore.getState().editingTextElementId).toBe(checklist?.id);
  });

  it("nao cria outro elemento ao clicar em elemento existente", async () => {
    const page = activePage();
    render(<DocumentPage page={page} className="test-page" label="Pagina teste" />);
    mockPaperRect();
    const before = page.elements.length;

    await userEvent.click(screen.getAllByRole("button", { name: "Selecionar elemento text" })[0]);

    expect(useDocumentStore.getState().documents[0].pages[0].elements).toHaveLength(before);
  });

  it("desseleciona ao clicar na area vazia antes de executar a ferramenta ativa", () => {
    const page = activePage();
    const selectedElement = page.elements[0];
    useAppStore.getState().setActiveTool("text");
    useEditorStore.getState().setEditorMode("text");
    useDocumentStore.getState().selectElement(selectedElement.id);
    render(<DocumentPage page={page} className="test-page" label="Pagina teste" />);
    const paper = mockPaperRect();
    const before = page.elements.length;

    fireEvent.click(paper, { clientX: 320, clientY: 250 });

    expect(useDocumentStore.getState().selectedElementId).toBeNull();
    expect(useDocumentStore.getState().documents[0].pages[0].elements).toHaveLength(before);
  });

  it("desseleciona ao clicar fora durante a edicao de texto", () => {
    const page = activePage();
    const textElement = page.elements.find((element) => element.type === "text");
    if (!textElement) throw new Error("Text element not found");
    useDocumentStore.getState().selectElement(textElement.id);
    useEditorStore.getState().setEditingTextElementId(textElement.id);
    render(<DocumentPage page={page} className="test-page" label="Pagina teste" />);
    const paper = mockPaperRect();

    fireEvent.click(paper, { clientX: 320, clientY: 250 });

    expect(useDocumentStore.getState().selectedElementId).toBeNull();
  });

  it("nao cria quando ferramenta nao tem acao de criacao", () => {
    useAppStore.getState().setActiveTool("pen-ruler");
    const page = activePage();
    render(<DocumentPage page={page} className="test-page" label="Pagina teste" />);
    const paper = mockPaperRect();
    const before = page.elements.length;

    fireEvent.click(paper, { clientX: 320, clientY: 250 });

    expect(useDocumentStore.getState().documents[0].pages[0].elements).toHaveLength(before);
    expect(useDocumentStore.getState().selectedElementId).toBeNull();
  });

  it("expoe identificacao da folha e nao cria ferramenta durante drag externo", () => {
    const page = activePage();
    useEditorStore.getState().beginAssetDrag({
      assetId: "sticker-sheet",
      assetType: "sticker",
      sourceCategory: "stickers",
      previewSrc: "/sticker.png",
      previewAlt: "Sticker",
      pointerX: 320,
      pointerY: 250,
    });
    useEditorStore.getState().setAssetDragTarget({
      targetPageId: page.id,
      targetDocumentId: page.documentId,
      validDrop: true,
    });
    render(<DocumentPage page={page} className="test-page" label="Pagina teste" />);
    const paper = mockPaperRect();
    const before = page.elements.length;

    fireEvent.click(paper, { clientX: 320, clientY: 250 });

    expect(paper).toHaveAttribute("data-page-id", page.id);
    expect(paper).toHaveAttribute("data-document-id", page.documentId);
    expect(useDocumentStore.getState().documents[0].pages[0].elements).toHaveLength(before);
    expect(document.querySelector(".page-drop-layer")).toBeInTheDocument();
  });
});
