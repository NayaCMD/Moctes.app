import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { initialDocuments } from "../../data/initialDocuments";
import { resetStores } from "../../test/helpers/resetStores";
import { PageNavigation } from "./PageNavigation";

describe("PageNavigation", () => {
  beforeEach(() => resetStores());

  it("mostra o numero final do par atual do caderno como contador desabilitado", () => {
    const document = initialDocuments[0];
    render(<PageNavigation document={document} pages={document.pages} />);

    expect(screen.getByLabelText("Página atual")).toBeInTheDocument();

    const counter = screen.getByRole("button", { name: "Páginas 1 a 2 de 2" });
    expect(counter).toBeDisabled();
    expect(counter).toHaveTextContent("2");
    expect(counter).toHaveAttribute("title", "Páginas 1 a 2 de 2");
  });

  it("mostra a pagina ativa para documentos de pagina unica", () => {
    const document = initialDocuments[1];
    render(<PageNavigation document={document} pages={document.pages} />);

    const counter = screen.getByRole("button", { name: "Página 1 de 1" });
    expect(counter).toBeDisabled();
    expect(counter).toHaveTextContent("1");
  });

  it("nao renderiza contador quando nao ha paginas", () => {
    const document = initialDocuments[0];
    const { container } = render(<PageNavigation document={document} pages={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
