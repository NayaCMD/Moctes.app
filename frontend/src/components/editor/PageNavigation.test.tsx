import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialDocuments } from "../../data/initialDocuments";
import { resetStores } from "../../test/helpers/resetStores";
import { useAppStore } from "../../stores/useAppStore";
import { PageNavigation } from "./PageNavigation";

describe("PageNavigation", () => {
  beforeEach(() => resetStores());

  it("mostra o par de paginas do caderno no topo e permite navegar", async () => {
    const document = initialDocuments[0];
    const onSelectPage = vi.fn();
    render(<PageNavigation document={document} pages={document.pages} onSelectPage={onSelectPage} />);

    expect(screen.getByRole("navigation", { name: "Navegação de páginas" })).toBeInTheDocument();
    expect(screen.getByText("Páginas 1-2 de 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(onSelectPage).toHaveBeenCalledWith(document.pages[1].id);
  });

  it("oculta e mostra a navegacao por preferencia persistida", async () => {
    const document = initialDocuments[0];
    render(<PageNavigation document={document} pages={document.pages} onSelectPage={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Ocultar navegação de páginas" }));
    expect(useAppStore.getState().showPageNavigation).toBe(false);
    expect(screen.getByRole("button", { name: "Mostrar navegação de páginas" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Mostrar navegação de páginas" }));
    expect(useAppStore.getState().showPageNavigation).toBe(true);
  });
});
