import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToolPopover } from "./ToolPopover";

const anchor = { x: 500, y: 610, width: 42, height: 42 };

describe("ToolPopover", () => {
  it("renderiza titulo, seta visual e tamanho do painel ancorado", async () => {
    const onClose = vi.fn();
    render(
      <ToolPopover title="Emojis" panel="emoji" anchor={anchor} onClose={onClose}>
        <button type="button">Escolher</button>
      </ToolPopover>,
    );

    const dialog = screen.getByRole("dialog", { name: "Emojis" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("data-panel", "emoji");
    expect(dialog).toHaveStyle({ width: "400px" });
    expect(dialog.style.getPropertyValue("--tool-popover-arrow-left")).not.toBe("");
  });

  it("fecha com Escape e devolve foco ao botao", async () => {
    const onClose = vi.fn();
    const focusTarget = document.createElement("button");
    focusTarget.textContent = "Emojis";
    document.body.appendChild(focusTarget);
    render(
      <ToolPopover
        title="Emojis"
        panel="emoji"
        anchor={anchor}
        onClose={onClose}
        returnFocusTo={focusTarget}
      >
        <button type="button">Escolher</button>
      </ToolPopover>,
    );

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(focusTarget).toHaveFocus();
  });

  it("fecha ao clicar fora", async () => {
    const onClose = vi.fn();
    render(
      <>
        <ToolPopover title="Imagens" panel="images" anchor={anchor} onClose={onClose}>
          <button type="button">Escolher</button>
        </ToolPopover>
        <button type="button">Fora</button>
      </>,
    );

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await userEvent.click(screen.getByRole("button", { name: "Fora" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renderiza acao de cabecalho ao lado do fechar", async () => {
    const onImport = vi.fn();
    render(
      <ToolPopover
        title="Formas e stickers"
        panel="shapes"
        anchor={anchor}
        onClose={vi.fn()}
        headerAction={
          <button type="button" aria-label="Importar forma ou sticker SVG" onClick={onImport}>
            +
          </button>
        }
      >
        <span>Conteudo</span>
      </ToolPopover>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Importar forma ou sticker SVG" }));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Fechar painel" })).toBeInTheDocument();
  });
});
