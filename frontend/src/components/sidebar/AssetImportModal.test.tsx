import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStores } from "../../test/helpers/resetStores";
import { AssetImportModal } from "./AssetImportModal";

describe("AssetImportModal", () => {
  beforeEach(() => resetStores());

  it("permite escolher importar SVG como forma ou sticker", async () => {
    render(<AssetImportModal open initialType="sticker" svgMode="shape" onClose={vi.fn()} />);
    const file = new File(['<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>'], "forma.svg", {
      type: "image/svg+xml",
    });

    const input = document.querySelector<HTMLInputElement>("input[type='file']");
    if (!input) {
      throw new Error("File input not found");
    }
    await userEvent.upload(input, file);

    expect(screen.getByText("Importar como")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Forma" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Sticker" })).toBeInTheDocument();
  });
});
