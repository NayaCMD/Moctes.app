import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultLibraryAssets } from "../../data/initialAssetLibrary";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { resetStores } from "../../test/helpers/resetStores";
import { AssetPickerPanel } from "./AssetPickerPanel";
import { DrawingPanel } from "./DrawingPanel";
import { EmojiPicker } from "./EmojiPicker";
import { ShapeStickerPicker } from "./ShapeStickerPicker";

describe("tool pickers", () => {
  beforeEach(() => resetStores());

  it("EmojiPicker busca em portugues, troca categorias e insere metadados", async () => {
    const onPick = vi.fn();
    render(<EmojiPicker destinationLabel="Destino: Pagina esquerda" onPick={onPick} />);

    expect(screen.getByRole("tab", { name: "Rostos" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "Animais" }));
    expect(screen.getByRole("tab", { name: "Animais" })).toHaveAttribute("aria-selected", "true");
    expect(onPick).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Buscar emojis"), "cão");
    await userEvent.click(screen.getByRole("button", { name: "Inserir Rosto de cachorro" }));
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "unicode:cachorro",
        provider: "noto-color-emoji",
        shortcode: "cachorro",
      }),
      { keepOpen: false },
    );
    expect(screen.getByText("Destino: Pagina esquerda")).toBeInTheDocument();
  });

  it("EmojiPicker persiste recentes, favoritos e manter aberto por usuario", async () => {
    const onPick = vi.fn();
    render(<EmojiPicker destinationLabel="Destino" onPick={onPick} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Adicionar Rosto sorridente aos favoritos" }),
    );
    await userEvent.click(screen.getByRole("tab", { name: "Favoritos" }));
    expect(screen.getByRole("button", { name: "Inserir Rosto sorridente" })).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Manter aberto para inserir vários"));
    await userEvent.click(screen.getByRole("button", { name: "Inserir Rosto sorridente" }));
    expect(onPick).toHaveBeenLastCalledWith(expect.objectContaining({ emoji: "😀" }), {
      keepOpen: true,
    });

    await userEvent.click(screen.getByRole("tab", { name: "Recentes" }));
    expect(screen.getByRole("button", { name: "Inserir Rosto sorridente" })).toBeInTheDocument();
    expect(window.localStorage.getItem("moctes:emoji-picker:v2:anonymous")).toContain(
      "unicode:sorriso_aberto",
    );
  });

  it("EmojiPicker oferece vazio, carregamento incremental e navegacao por teclado", async () => {
    render(<EmojiPicker destinationLabel="Destino" onPick={vi.fn()} />);
    const search = screen.getByLabelText("Buscar emojis");
    await userEvent.type(search, "resultado inexistente");
    expect(screen.getByText("Nada por aqui")).toBeInTheDocument();
    expect(screen.getByText(/Nenhum emoji encontrado/)).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "Limpar busca" })[0]);
    const first = screen.getByRole("button", { name: "Inserir Rosto sorridente" });
    first.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Inserir Sorriso com olhos grandes" })).toHaveFocus();

    screen.getByRole("tab", { name: "Rostos" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Pessoas" })).toHaveAttribute("aria-selected", "true");

    await userEvent.type(search, "a");
    expect(screen.getByRole("button", { name: "Carregar mais emojis" })).toBeInTheDocument();
  });

  it("EmojiPicker arrasta para a pagina e seleciona imediatamente", () => {
    const state = useDocumentStore.getState();
    const activeDocument = state.documents.find((document) => document.id === state.activeDocumentId)!;
    const page = activeDocument.pages.find((candidate) => candidate.id === state.activePageId)!;
    const pageElement = document.createElement("section");
    pageElement.dataset.pageId = page.id;
    pageElement.dataset.documentId = activeDocument.id;
    pageElement.getBoundingClientRect = () =>
      ({ left: 100, top: 50, width: 400, height: 500, right: 500, bottom: 550 }) as DOMRect;
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: vi.fn(() => [pageElement]),
    });
    const onDragInserted = vi.fn();
    render(
      <EmojiPicker
        destinationLabel="Destino"
        onPick={vi.fn()}
        onDragInserted={onDragInserted}
      />,
    );
    const before = page.elements.length;
    const emoji = screen.getByRole("button", { name: "Inserir Rosto sorridente" });

    fireEvent.pointerDown(emoji, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 300, clientY: 300 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 300, clientY: 300 });

    const nextElements = useDocumentStore.getState().documents
      .find((document) => document.id === activeDocument.id)!
      .pages.find((candidate) => candidate.id === page.id)!.elements;
    expect(nextElements).toHaveLength(before + 1);
    expect(nextElements.at(-1)).toMatchObject({
      type: "emoji",
      content: {
        emojiId: "unicode:sorriso_aberto",
        provider: "noto-color-emoji",
      },
    });
    expect(useDocumentStore.getState().selectedElementId).toBe(nextElements.at(-1)?.id);
    expect(onDragInserted).toHaveBeenCalledWith(
      expect.objectContaining({ id: "unicode:sorriso_aberto" }),
      { keepOpen: false },
    );
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
    expect(screen.getByRole("button", { name: "Adicionar à página" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Buscar"), "caderno");
    const imageButton = screen.getByRole("button", { name: "Selecionar Caderno colorido" });
    await userEvent.click(imageButton);
    expect(onPick).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Adicionar à página" }));
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
