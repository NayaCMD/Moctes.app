import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultLibraryAssets } from "../../data/initialAssetLibrary";
import { resetStores } from "../../test/helpers/resetStores";
import { AssetPickerPanel } from "./AssetPickerPanel";
import { DrawingPanel } from "./DrawingPanel";
import { EmojiPicker } from "./EmojiPicker";
import { ShapeStickerPicker } from "./ShapeStickerPicker";

describe("tool pickers", () => {
  beforeEach(() => resetStores());

  it("EmojiPicker troca categorias e insere somente apos escolha", async () => {
    const onPick = vi.fn();
    render(<EmojiPicker destinationLabel="Destino: Pagina esquerda" onPick={onPick} />);

    expect(screen.getByRole("tab", { name: "Recentes" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "Natureza" }));
    expect(screen.getByRole("tab", { name: "Natureza" })).toHaveAttribute("aria-selected", "true");
    expect(onPick).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Inserir emoji 🌿" }));
    expect(onPick).toHaveBeenCalledWith("🌿");
    expect(screen.getByText("Destino: Pagina esquerda")).toBeInTheDocument();
  });

  it("ShapeStickerPicker organiza abas e controles de forma", async () => {
    const onPickShape = vi.fn();
    const onPickSticker = vi.fn();
    const onImportShapeSvg = vi.fn();
    const onImportStickerSvg = vi.fn();
    const onFill = vi.fn();
    const stickers = defaultLibraryAssets.filter((asset) => asset.type === "sticker");
    render(
      <ShapeStickerPicker
        stickers={stickers}
        destinationLabel="Destino: Pagina direita"
        fillColor="#dfe8ff"
        borderColor="#8da3ed"
        borderWidth={2}
        onFillColorChange={onFill}
        onBorderColorChange={vi.fn()}
        onBorderWidthChange={vi.fn()}
        onPickShape={onPickShape}
        onPickSticker={onPickSticker}
        onImportShapeSvg={onImportShapeSvg}
        onImportStickerSvg={onImportStickerSvg}
      />,
    );

    expect(screen.getByRole("tab", { name: "Formas" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("button", { name: "+ Importar forma SVG" }));
    expect(onImportShapeSvg).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "preenchimento #ffe3ef" }));
    expect(onFill).toHaveBeenCalledWith("#ffe3ef");
    await userEvent.click(screen.getByRole("button", { name: "Inserir Circulo" }));
    expect(onPickShape).toHaveBeenCalledWith("circle");

    await userEvent.click(screen.getByRole("tab", { name: "Stickers" }));
    expect(screen.getByRole("tab", { name: "Stickers" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Destino: Pagina direita")).toBeInTheDocument();
  });

  it("ShapeStickerPicker oferece importar sticker SVG no estado vazio", async () => {
    const onImportStickerSvg = vi.fn();
    render(
      <ShapeStickerPicker
        stickers={[]}
        destinationLabel="Destino: Pagina direita"
        fillColor="#dfe8ff"
        borderColor="#8da3ed"
        borderWidth={2}
        onFillColorChange={vi.fn()}
        onBorderColorChange={vi.fn()}
        onBorderWidthChange={vi.fn()}
        onPickShape={vi.fn()}
        onPickSticker={vi.fn()}
        onImportStickerSvg={onImportStickerSvg}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Stickers" }));
    expect(screen.getByText("Nenhum sticker nesta pasta.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "+ Importar sticker SVG" }));
    expect(onImportStickerSvg).toHaveBeenCalled();
  });

  it("AssetPickerPanel seleciona, filtra e adiciona com acao explicita", async () => {
    const onPick = vi.fn();
    const images = defaultLibraryAssets.filter((asset) => asset.type === "image");
    render(
      <AssetPickerPanel
        title="Imagens"
        assets={images}
        emptyMessage="Nenhuma imagem."
        destinationLabel="Destino: Pagina 2"
        onPick={onPick}
        onImport={vi.fn()}
        variant="image"
      />,
    );

    expect(screen.getByRole("button", { name: "Importar imagem" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar a pagina" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Buscar"), "caderno");
    const imageButton = screen.getByRole("button", { name: "Selecionar Caderno colorido" });
    await userEvent.click(imageButton);
    expect(onPick).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Adicionar a pagina" }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: "caderno-cores" }));
    expect(screen.getByText("Destino: Pagina 2")).toBeInTheDocument();
  });

  it("AssetPickerPanel renderiza tapes em modo horizontal", () => {
    const tapes = defaultLibraryAssets.filter((asset) => asset.type === "tape");
    render(
      <AssetPickerPanel
        title="Tapes"
        assets={tapes}
        emptyMessage="Nenhuma tape."
        destinationLabel="Destino: Pagina esquerda"
        onPick={vi.fn()}
        onImport={vi.fn()}
        variant="tape"
      />,
    );

    expect(screen.getByRole("button", { name: "Importar tape" })).toBeInTheDocument();
    expect(document.querySelector(".tool-asset-grid")).toHaveAttribute("data-variant", "tape");
  });

  it("DrawingPanel exibe abas, amostra e estado de desenho", async () => {
    const onActiveTabChange = vi.fn();
    const onRulerMode = vi.fn();
    render(
      <DrawingPanel
        activeTab="pen"
        settings={{ mode: "pen", color: "#4466cc", strokeWidth: 4, opacity: 0.8 }}
        ruler={{ visible: false, x: 42, y: 52, rotation: 0, length: 64 }}
        isDrawing={true}
        onActiveTabChange={onActiveTabChange}
        onSettingsChange={vi.fn()}
        onRulerChange={vi.fn()}
        onDrawMode={vi.fn()}
        onRulerMode={onRulerMode}
      />,
    );

    expect(screen.getByText("Desenhando...")).toBeInTheDocument();
    expect(screen.getByLabelText("Previa do traco")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Regua" }));
    expect(onActiveTabChange).toHaveBeenCalledWith("ruler");
    expect(onRulerMode).toHaveBeenCalled();
  });
});
