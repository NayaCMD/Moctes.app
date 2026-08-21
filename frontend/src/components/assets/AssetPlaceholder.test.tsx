import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AssetPlaceholder } from "./AssetPlaceholder";

describe("AssetPlaceholder", () => {
  it("presents processing as progress instead of an error", () => {
    render(<AssetPlaceholder availability="processing" />);

    expect(
      screen.getByRole("status", { name: /Processando imagem/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/indisponível/i)).not.toBeInTheDocument();
  });

  it("differentiates rejected and removed files", () => {
    const { rerender } = render(
      <AssetPlaceholder availability="rejected" />,
    );
    expect(screen.getByRole("alert", { name: /Arquivo não permitido/i })).toBeInTheDocument();

    rerender(<AssetPlaceholder availability="not-found" />);
    expect(
      screen.getByRole("group", { name: /não está mais disponível/i }),
    ).toBeInTheDocument();
  });

  it("offers an explicit bounded retry action", async () => {
    const retry = vi.fn();
    render(<AssetPlaceholder availability="error" onRetry={retry} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Tentar novamente" }),
    );
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
