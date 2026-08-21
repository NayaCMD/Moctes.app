import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PageTemplatePicker } from "./PageTemplatePicker";

describe("PageTemplatePicker", () => {
  it("lista todos os templates e informa que o conteúdo é editável", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <PageTemplatePicker
        open
        documentType="notebook"
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Escolha um template" })).toBeVisible();
    expect(screen.getByText(/elementos totalmente editáveis/i)).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(10);

    await user.click(screen.getByRole("button", { name: /Moodboard/ }));
    expect(onSelect).toHaveBeenCalledWith("moodboard");
  });

  it("fecha com Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <PageTemplatePicker
        open
        documentType="clipboard"
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
