import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { initialDocuments } from "../../data/initialDocuments";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { resetStores } from "../../test/helpers/resetStores";
import type { MoctesDocument } from "../../types/document.types";
import type { NotebookSection, NotebookSurface } from "../../types/notebook.types";
import { reconcileNotebookDocument } from "../../utils/notebookMigration.utils";
import { buildNotebookSurfaces } from "../../utils/notebookSurfaces.utils";
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

describe("Notebook visual estático", () => {
  beforeEach(() => resetStores());

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
    const section = getSection(getNotebookDocument());

    render(<NotebookDivider section={section} isActive />);

    expect(screen.getByRole("heading", { name: section.title })).toBeInTheDocument();
    expect(screen.getByText("2 folhas")).toBeInTheDocument();
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
      pages: [],
    };
    const selectedSections: string[] = [];

    render(
      <NotebookTabs
        sections={[firstSection, secondSection]}
        activeSectionId={secondSection.id}
        onSelectSection={(sectionId) => selectedSections.push(sectionId)}
      />,
    );

    const tabs = screen.getAllByRole("button");
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
          pages: [stalePage],
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

  it("abas do NotebookView abrem a divisória e não alteram activePageId para ID de divisória", async () => {
    const user = userEvent.setup();
    useDocumentStore.getState().addSection(getNotebookDocument().id, {
      title: "Back-end",
      createInitialPage: false,
    });
    const document = getNotebookDocument();
    const targetSection = getSection(document, 1);
    const previousActivePageId = document.activePageId;

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
    render(<NotebookHarness />);

    expect(screen.getByRole("button", { name: "Superfície anterior" })).toBeDisabled();
    expect(screen.getByLabelText(`Divisória ${getSection(document).title}`)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Próxima superfície" }));

    const activeAfterNext = getNotebookDocument().activeSurfaceId;
    expect(activeAfterNext).toBe(document.pages[0].id);
    expect(screen.getByLabelText("Folha 1 de 2")).toHaveTextContent("1");

    await user.click(screen.getByRole("button", { name: "Superfície anterior" }));

    expect(getNotebookDocument().activeSurfaceId).toBe(firstSurface.id);
  });

  it("a última folha não possui próxima superfície e divisórias não entram na contagem", () => {
    const document = getNotebookDocument();
    const lastPage = document.pages.at(-1);

    if (!lastPage) {
      throw new Error("Last page not found");
    }

    useDocumentStore.getState().goToPage(lastPage.id, document.id);
    render(<NotebookHarness />);

    expect(screen.getByRole("button", { name: "Próxima superfície" })).toBeDisabled();
    expect(screen.getByLabelText("Folha 2 de 2")).toHaveTextContent("2");
  });

  it("documento legado reconciliado renderiza sem erro", () => {
    const legacyDocument = reconcileNotebookDocument({
      ...initialDocuments[0],
      schemaVersion: undefined,
      cover: undefined,
      sections: undefined,
      activeSurfaceId: undefined,
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
