import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { initialDocuments } from "../../data/initialDocuments";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { resetStores } from "../../test/helpers/resetStores";
import { PageNavigation } from "./PageNavigation";

describe("PageNavigation", () => {
  beforeEach(() => resetStores());

  it("agrupa o contador e as ações de navegação", () => {
    const document = initialDocuments[1];
    render(<PageNavigation document={document} pages={document.pages} />);

    expect(screen.getByLabelText("Navegação de páginas")).toBeInTheDocument();
    expect(screen.getByLabelText("Página 1 de 1")).toHaveTextContent("1/ 1");
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Adicionar página" })).toBeEnabled();
  });

  it("abre templates e cria uma página pelo controle agrupado", async () => {
    const user = userEvent.setup();
    const document = initialDocuments[1];
    render(<PageNavigation document={document} pages={document.pages} />);

    const previousCount = useDocumentStore
      .getState()
      .documents.find((item) => item.id === document.id)?.pages.length;
    await user.click(screen.getByRole("button", { name: "Adicionar página" }));
    expect(screen.getByRole("dialog", { name: "Escolha um template" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Página em branco/ }));
    const nextCount = useDocumentStore
      .getState()
      .documents.find((item) => item.id === document.id)?.pages.length;

    expect(nextCount).toBe((previousCount ?? 0) + 1);
  });

  it("não renderiza controles quando não há páginas", () => {
    const document = initialDocuments[0];
    const { container } = render(<PageNavigation document={document} pages={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
