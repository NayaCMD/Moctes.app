import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStores } from "../../test/helpers/resetStores";
import { useAssetLibraryStore } from "../../stores/useAssetLibraryStore";
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

  it("keeps the local preview and exposes the uploading state", async () => {
    render(
      <AssetImportModal open initialType="image" onClose={vi.fn()} />,
    );
    const fileInput = document.querySelector<HTMLInputElement>(
      "input[type='file']",
    );
    if (!fileInput) {
      throw new Error("File input not found");
    }
    await userEvent.upload(
      fileInput,
      new File([new Uint8Array([1, 2, 3])], "preview.png", {
        type: "image/png",
      }),
    );
    act(() => useAssetLibraryStore.setState({ importStatus: "importing" }));

    expect(screen.getByRole("dialog", { name: "Importar imagem" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("img", { name: "Preview do asset" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: /Enviando imagem/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviando…" })).toBeDisabled();
  });
});
