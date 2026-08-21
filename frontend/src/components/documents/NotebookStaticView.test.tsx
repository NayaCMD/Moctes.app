import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { initialDocuments } from "../../data/initialDocuments";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { useEditorStore } from "../../stores/useEditorStore";
import { resetStores } from "../../test/helpers/resetStores";
import type { MoctesDocument } from "../../types/document.types";
import type { NotebookSection, NotebookSurface } from "../../types/notebook.types";
import { getEditableActivePage } from "../../utils/document.utils";
import { reconcileNotebookDocument } from "../../utils/notebookMigration.utils";
import {
  buildNotebookSurfaces,
  getPagesInSection,
} from "../../utils/notebookSurfaces.utils";
import { NotebookCover } from "./NotebookCover";
import { NotebookDivider } from "./NotebookDivider";
import { NotebookSurfaceRenderer } from "./NotebookSurfaceRenderer";
import { NotebookTabs } from "./NotebookTabs";
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

function getSection(document: MoctesDocument, index = 0): NotebookSection {
  const section = document.sections?.[index];

  if (!section) {
    throw new Error("Notebook section not found");
  }

  return section;
}

function getSurface(
  document: MoctesDocument,
  predicate: (surface: NotebookSurface) => boolean,
): NotebookSurface {
  const surface = buildNotebookSurfaces(document).find(predicate);

  if (!surface) {
    throw new Error("Notebook surface not found");
  }

  return surface;
}

function NotebookHarness() {
  const document = useDocumentStore((state) =>
    state.documents.find((item) => item.type === "notebook"),
  );

  return document ? <NotebookView document={document} /> : null;
}

function openNotebookForTest() {
  useEditorStore.setState({
    notebookBook: { documentId: getNotebookDocument().id, phase: "open" },
  });
}

describe("Notebook visual estático", () => {
  beforeEach(() => resetStores());

  it("NotebookView inicia fechado e bloqueia edição da página ativa", () => {
    const document = getNotebookDocument();

    render(<NotebookView document={document} />);

    expect(screen.getByRole("button", { name: "Abrir caderno" })).toBeInTheDocument();
    expect(screen.getByText("Caderno fechado")).toBeInTheDocument();
    expect(globalThis.document.querySelector(".notebook-ring")).toHaveAttribute("data-mode", "closed");
    expect(getEditableActivePage(document, {
      notebookBook: useEditorStore.getState().notebookBook,
      notebookTransition: useEditorStore.getState().notebookTransition,
    })).toBeUndefined();
  });

  it("clique na capa inicia opening sem alterar activeSurfaceId e transitionend conclui open", async () => {
    const user = userEvent.setup();
    const initialSurfaceId = getNotebookDocument().activeSurfaceId;

    render(<NotebookHarness />);
    const cover = screen.getByRole("button", { name: "Abrir caderno" });
    await user.click(cover);

    expect(useEditorStore.getState().notebookBook).toMatchObject({
      documentId: getNotebookDocument().id,
      phase: "opening",
    });
    expect(getNotebookDocument().activeSurfaceId).toBe(initialSurfaceId);

    fireEvent.transitionEnd(cover, { propertyName: "transform" });

    expect(useEditorStore.getState().notebookBook?.phase).toBe("open");
    expect(getNotebookDocument().activeSurfaceId).toBe(initialSurfaceId);
    expect(screen.getByRole("button", { name: "Fechar caderno" })).toBeInTheDocument();
  });

  it("fechar caderno inicia closing e volta a bloquear edição", async () => {
    const user = userEvent.setup();
    openNotebookForTest();
    render(<NotebookHarness />);

    await user.click(screen.getByRole("button", { name: "Fechar caderno" }));
    expect(useEditorStore.getState().notebookBook?.phase).toBe("closing");

    const cover = screen.getByRole("button", { name: "Abrir caderno", hidden: true });
    fireEvent.transitionEnd(cover, { propertyName: "transform" });

    expect(useEditorStore.getState().notebookBook?.phase).toBe("closed");
    expect(getEditableActivePage(getNotebookDocument(), {
      notebookBook: useEditorStore.getState().notebookBook,
      notebookTransition: useEditorStore.getState().notebookTransition,
    })).toBeUndefined();
  });

  it("closed não inicia page flip, mas open inicia normalmente", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<NotebookHarness />);

    await user.click(screen.getByRole("button", { name: "Próxima superfície" }));
    expect(globalThis.document.querySelector(".notebook-leaf")).not.toBeInTheDocument();

    openNotebookForTest();
    rerender(<NotebookHarness />);
    await user.click(screen.getByRole("button", { name: "Próxima superfície" }));
    expect(globalThis.document.querySelector(".notebook-leaf")).toBeInTheDocument();
  });

  it("open renderiza spread com folha de guarda, slot direito ativo e sem duas páginas editáveis", () => {
    const document = getNotebookDocument();
    const firstSection = getSection(document);
    useDocumentStore.getState().goToSection(firstSection.id, document.id);
    openNotebookForTest();

    render(<NotebookHarness />);

    expect(globalThis.document.querySelector(".notebook-guard-page")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: `Divisória da seção ${firstSection.title}` })).toBeInTheDocument();
    expect(globalThis.document.querySelectorAll(".notebook-spread-slot[data-editable='true']")).toHaveLength(0);
  });

  it("open coloca a superfície anterior no slot esquerdo e a página ativa editável no direito", () => {
    const document = getNotebookDocument();
    useDocumentStore.getState().goToPage(document.pages[0].id, document.id);
    openNotebookForTest();

    render(<NotebookHarness />);

    expect(globalThis.document.querySelector(".notebook-spread-slot[data-side='left'] .notebook-divider-surface")).toBeInTheDocument();
    expect(globalThis.document.querySelector(".notebook-stage .paper-surface")).toHaveAttribute(
      "data-page-id",
      document.pages[0].id,
    );
    expect(globalThis.document.querySelectorAll(".notebook-stage .paper-surface[data-active-page='true']")).toHaveLength(1);
  });

  it("permite selecionar e editar elementos nas duas páginas visíveis sem virar o spread", async () => {
    const user = userEvent.setup();
    const document = getNotebookDocument();
    const secondPage = document.pages[1];
    const firstPage = document.pages[0];

    if (!firstPage || !secondPage) {
      throw new Error("Notebook pages not found");
    }

    useDocumentStore.getState().goToPage(secondPage.id, document.id);
    openNotebookForTest();

    render(<NotebookHarness />);

    const leftElement = globalThis.document.querySelector<HTMLElement>(
      ".notebook-spread-slot[data-side='left'] .page-element-frame",
    );
    expect(leftElement).toBeInTheDocument();
    expect(leftElement).toHaveAttribute("data-readonly", "false");
    expect(leftElement).toHaveAttribute("role", "button");
    expect(leftElement).toHaveAttribute("tabindex", "0");
    expect(globalThis.document.querySelectorAll(".notebook-spread-slot[data-editable='true']")).toHaveLength(1);

    await user.click(leftElement!);

    const state = useDocumentStore.getState();
    const stateDocument = state.documents.find((item) => item.id === document.id);
    expect(state.selectedElementId).toBe(firstPage.elements[0].id);
    expect(state.activePageId).toBe(firstPage.id);
    expect(stateDocument?.activePageId).toBe(firstPage.id);
    expect(stateDocument?.activeSurfaceId).toBe(secondPage.id);
    expect(getEditableActivePage(stateDocument!, {
      notebookBook: useEditorStore.getState().notebookBook,
      notebookTransition: useEditorStore.getState().notebookTransition,
    })?.id).toBe(firstPage.id);
  });

  it("NotebookCover usa os valores da capa e fica decorativo", () => {
    render(
      <NotebookCover
        binding="left"
        cover={{
          color: "#123456",
          borderColor: "#abcdef",
          cornerRadius: 18,
        }}
      />,
    );

    const cover = document.querySelector<HTMLElement>(".notebook-cover");
    expect(cover).toBeInTheDocument();
    expect(cover).toHaveAttribute("aria-hidden", "true");
    expect(cover).toHaveStyle({
      "--notebook-cover-color": "#123456",
      "--notebook-cover-border-color": "#abcdef",
      "--notebook-cover-radius": "18px",
    });
  });

  it("NotebookDivider mostra título, quantidade de folhas e não renderiza PaperSurface", () => {
    const notebookDocument = getNotebookDocument();
    const section = getSection(notebookDocument);

    render(
      <NotebookDivider
        section={section}
        pageCount={getPagesInSection(notebookDocument, section.id).length}
        isActive
      />,
    );

    expect(screen.getByRole("heading", { name: section.title })).toBeInTheDocument();
    expect(screen.getByText("2 páginas")).toBeInTheDocument();
    expect(document.querySelector(".paper-surface")).not.toBeInTheDocument();
  });

  it("NotebookTabs preserva a ordem, indica a seção ativa e chama a seleção correta", async () => {
    const user = userEvent.setup();
    const firstSection = getSection(getNotebookDocument());
    const secondSection: NotebookSection = {
      ...firstSection,
      id: "section-extra",
      title: "Back-end",
      divider: {
        ...firstSection.divider,
        id: "divider-extra",
        tabColor: "#f7d36d",
      },
    };
    const selectedSections: string[] = [];

    render(
      <NotebookTabs
        documentId={getNotebookDocument().id}
        sections={[firstSection, secondSection]}
        activeSectionId={secondSection.id}
        onSelectSection={(sectionId) => selectedSections.push(sectionId)}
      />,
    );

    const tabs = screen.getAllByRole("button", { name: /Abrir divisória/i });
    expect(tabs.map((tab) => tab.textContent)).toEqual([firstSection.title, "Back-end"]);
    expect(screen.getByRole("button", { name: "Abrir divisória Back-end" })).toHaveAttribute(
      "aria-current",
      "true",
    );

    await user.click(screen.getByRole("button", { name: `Abrir divisória ${firstSection.title}` }));

    expect(selectedSections).toEqual([firstSection.id]);
  });

  it("NotebookSurfaceRenderer renderiza folha com conteúdo atualizado de document.pages", () => {
    const document = getNotebookDocument();
    const section = getSection(document);
    const page = document.pages[0];
    const freshElement = {
      ...page.elements[0],
      id: "el-fresh-content",
      type: "text" as const,
      content: { kind: "text" as const, text: "Conteúdo atualizado" },
    };
    const freshPage = { ...page, elements: [freshElement] };
    const stalePage = { ...page, elements: [] };
    const staleSurface: NotebookSurface = {
      kind: "page",
      id: page.id,
      sectionId: section.id,
      page: stalePage,
    };
    const nextDocument: MoctesDocument = {
      ...document,
      pages: [freshPage, ...document.pages.slice(1)],
      sections: [
        {
          ...section,
        },
      ],
    };

    render(<NotebookSurfaceRenderer document={nextDocument} activeSurface={staleSurface} />);

    expect(screen.getByLabelText(page.title ?? "Folha do caderno")).toHaveAttribute(
      "data-page-id",
      page.id,
    );
    expect(screen.getByText("Conteúdo atualizado")).toBeInTheDocument();
  });

  it("NotebookSurfaceRenderer renderiza divisória sem acessar elementos de página", () => {
    const notebookDocument = {
      ...getNotebookDocument(),
      pages: [],
    };
    const surface = getSurface(getNotebookDocument(), (item) => item.kind === "divider");

    render(<NotebookSurfaceRenderer document={notebookDocument} activeSurface={surface} />);

    expect(screen.getByRole("region", { name: /Divisória da seção/i })).toBeInTheDocument();
    expect(document.querySelector(".paper-surface")).not.toBeInTheDocument();
  });

  it("NotebookView usa activeSurfaceId e aplica fallback quando a superfície é inválida", () => {
    const document = {
      ...getNotebookDocument(),
      activeSurfaceId: "surface-inexistente",
    };
    const firstSection = getSection(document);

    render(<NotebookView document={document} />);

    expect(screen.getByRole("region", { name: `Divisória da seção ${firstSection.title}` })).toBeInTheDocument();
  });

  it("NotebookView isola capa, stage, abas, argolas e navegação dentro do shell compacto", () => {
    openNotebookForTest();
    render(<NotebookView document={getNotebookDocument()} />);

    const shell = document.querySelector<HTMLElement>(".notebook-shell");
    const cover = document.querySelector<HTMLElement>(".notebook-shell > .notebook-cover");
    const stage = document.querySelector<HTMLElement>(".notebook-spread > .notebook-stage");
    const spine = document.querySelector<HTMLElement>(".notebook-spread > .notebook-spread-spine");
    const tabs = document.querySelector<HTMLElement>(".notebook-shell > .notebook-tabs");
    const navigation = document.querySelector<HTMLElement>(".notebook-shell > .notebook-navigation");
    const surface = document.querySelector<HTMLElement>(".notebook-surface");
    const ring = document.querySelector<HTMLElement>(".notebook-spread-spine .notebook-ring");

    expect(shell).toBeInTheDocument();
    expect(cover).toBeInTheDocument();
    expect(stage).toBeInTheDocument();
    expect(spine).toBeInTheDocument();
    expect(ring).toBeInTheDocument();
    expect(ring?.tagName.toLowerCase()).toBe("svg");
    expect(ring).toHaveAttribute("data-mode", "open");
    expect(tabs).toBeInTheDocument();
    expect(navigation).toBeInTheDocument();
    expect(stage).toContainElement(surface);
    expect(stage).not.toContainElement(tabs);
    expect(stage).not.toContainElement(spine);
    expect(stage).not.toContainElement(navigation);
  });

  it("mantém tabs, rings e navegação fora da folha rotativa", async () => {
    const user = userEvent.setup();
    openNotebookForTest();
    render(<NotebookHarness />);

    await user.click(screen.getByRole("button", { name: "Próxima superfície" }));

    const shell = document.querySelector<HTMLElement>(".notebook-shell");
    const stage = document.querySelector<HTMLElement>(".notebook-stage");
    const leaf = document.querySelector<HTMLElement>(".notebook-leaf");
    const tabs = document.querySelector<HTMLElement>(".notebook-tabs");
    const spine = document.querySelector<HTMLElement>(".notebook-spread-spine");
    const navigation = document.querySelector<HTMLElement>(".notebook-navigation");

    expect(shell).toContainElement(tabs);
    expect(stage).toContainElement(leaf);
    expect(leaf).not.toContainElement(tabs);
    expect(leaf).not.toContainElement(spine);
    expect(leaf).not.toContainElement(navigation);
    expect(spine?.querySelector(".notebook-ring")).toBeInTheDocument();
  });

  it("NotebookDivider não renderiza aba visual duplicada", () => {
    const notebookDocument = getNotebookDocument();
    const section = getSection(notebookDocument);
    render(
      <NotebookDivider
        section={section}
        pageCount={getPagesInSection(notebookDocument, section.id).length}
        isActive
      />,
    );

    expect(document.querySelector(".notebook-divider-tab-marker")).not.toBeInTheDocument();
  });

  it("abas do NotebookView abrem a divisória e não alteram activePageId para ID de divisória", async () => {
    const user = userEvent.setup();
    useDocumentStore.getState().addSection(getNotebookDocument().id, {
      title: "Back-end",
      createInitialPage: false,
    });
    const document = getNotebookDocument();
    const targetSection = getSection(document, 1);
    const previousActivePageId = document.activePageId;

    openNotebookForTest();
    render(<NotebookHarness />);
    await user.click(screen.getByRole("button", { name: "Abrir divisória Back-end" }));

    const stateDocument = getNotebookDocument();
    expect(stateDocument.activeSurfaceId).toBe(targetSection.divider.id);
    expect(stateDocument.activePageId).toBe(previousActivePageId);
    expect(stateDocument.activePageId).not.toBe(targetSection.divider.id);
  });

  it("NotebookNavigation desabilita extremos e navega entre divisória e folhas", async () => {
    const user = userEvent.setup();
    const document = getNotebookDocument();
    const firstSurface = buildNotebookSurfaces(document)[0];

    if (!firstSurface) {
      throw new Error("First surface not found");
    }

    useDocumentStore.getState().goToSection(getSection(document).id, document.id);
    openNotebookForTest();
    render(<NotebookHarness />);

    expect(screen.getByRole("button", { name: "Superfície anterior" })).toBeDisabled();
    expect(screen.getByLabelText(`Divisória ${getSection(document).title}`)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Próxima superfície" }));

    const leaf = globalThis.document.querySelector(".notebook-leaf");
    if (!leaf) {
      throw new Error("Notebook leaf not found");
    }
    fireEvent.transitionEnd(leaf, { propertyName: "transform" });

    const activeAfterNext = getNotebookDocument().activeSurfaceId;
    expect(activeAfterNext).toBe(document.pages[0].id);
    expect(screen.getByLabelText("Página 1 de 2")).toHaveTextContent("1");

    await user.click(screen.getByRole("button", { name: "Superfície anterior" }));

    const previousLeaf = globalThis.document.querySelector(".notebook-leaf");
    if (!previousLeaf) {
      throw new Error("Notebook leaf not found");
    }
    fireEvent.transitionEnd(previousLeaf, { propertyName: "transform" });

    expect(getNotebookDocument().activeSurfaceId).toBe(firstSurface.id);
  });

  it("ignora key repeat durante navegação por teclado", () => {
    const document = getNotebookDocument();
    const initialSurfaceId = document.activeSurfaceId;

    openNotebookForTest();
    render(<NotebookHarness />);
    fireEvent.keyDown(window, { key: "PageDown", repeat: true });

    expect(getNotebookDocument().activeSurfaceId).toBe(initialSurfaceId);
    expect(globalThis.document.querySelector(".notebook-leaf")).not.toBeInTheDocument();
  });

  it("a última folha não possui próxima superfície e divisórias não entram na contagem", () => {
    const document = getNotebookDocument();
    const lastPage = document.pages.at(-1);

    if (!lastPage) {
      throw new Error("Last page not found");
    }

    useDocumentStore.getState().goToPage(lastPage.id, document.id);
    openNotebookForTest();
    render(<NotebookHarness />);

    expect(screen.getByRole("button", { name: "Próxima superfície" })).toBeDisabled();
    expect(screen.getByLabelText("Página 2 de 2")).toHaveTextContent("2");
  });

  it("documento legado reconciliado renderiza sem erro", () => {
    const legacyDocument = reconcileNotebookDocument({
      ...initialDocuments[0],
      schemaVersion: undefined,
      cover: undefined,
      sections: undefined,
      activeSurfaceId: undefined,
    });

    useEditorStore.setState({
      notebookBook: { documentId: legacyDocument.id, phase: "open" },
    });
    render(<NotebookView document={legacyDocument} />);

    expect(screen.getByRole("article", { name: "July Journal" })).toBeInTheDocument();
    expect(screen.getByLabelText("Dear diary")).toHaveClass("paper-surface");
  });

  it("outros tipos de documento continuam renderizando como antes", () => {
    const notepad = useDocumentStore
      .getState()
      .documents.find((item) => item.type === "notepad");

    if (!notepad) {
      throw new Error("Notepad document not found");
    }

    render(<NotepadView document={notepad} />);

    expect(screen.getByLabelText(notepad.pages[0].title ?? "Folha do bloco de notas")).toHaveClass(
      "paper-surface",
    );
    expect(globalThis.document.querySelector(".notebook-transition-layer")).not.toBeInTheDocument();
  });

  it("a folha ativa continua expondo elementos editáveis", () => {
    const document = getNotebookDocument();
    const pageSurface = getSurface(document, (item) => item.kind === "page");

    render(<NotebookSurfaceRenderer document={document} activeSurface={pageSurface} />);

    expect(screen.getByLabelText(document.pages[0].title ?? "Folha do caderno")).toHaveClass(
      "paper-surface",
    );
    expect(screen.getAllByRole("button", { name: /Selecionar elemento/i }).length).toBeGreaterThan(0);
  });
});
