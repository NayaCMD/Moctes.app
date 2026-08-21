import { expect, test } from "@playwright/test";
import {
  expectEditorWithinViewport,
  expectPopoverWithinViewport,
  openVisualNotebook,
  prepareVisualPage,
  waitForVisualStability,
} from "./fixtures/visualTest";

test.describe("regressão visual essencial do editor", () => {
  test.beforeEach(async ({ page }) => {
    await prepareVisualPage(page);
  });

  test("editor padrão em desktop 1440x900", async ({ page }) => {
    await page.setViewportSize({ width: 1_440, height: 900 });
    await openVisualNotebook(page);
    await expectEditorWithinViewport(page);

    await expect(page).toHaveScreenshot("editor-default-1440x900.png");
  });

  test("editor padrão em Full HD", async ({ page }) => {
    await page.setViewportSize({ width: 1_920, height: 1_080 });
    await openVisualNotebook(page);
    await expectEditorWithinViewport(page);

    await expect(page).toHaveScreenshot("editor-default-1920x1080.png");
  });

  test("editor padrão em viewport compacta", async ({ page }) => {
    await page.setViewportSize({ width: 1_280, height: 720 });
    await openVisualNotebook(page);
    await expectEditorWithinViewport(page);

    await expect(page).toHaveScreenshot("editor-default-1280x720.png");
  });

  test("painel de aparência com controles", async ({ page }) => {
    await page.setViewportSize({ width: 1_440, height: 1_200 });
    await openVisualNotebook(page);
    await page.getByRole("tab", { name: "Aparência" }).click();
    const panel = page.getByRole("tabpanel", { name: "Aparência" });
    await expect(panel).toBeVisible();
    await expect(panel.getByLabel("Tipo de página")).toBeVisible();
    await expect(panel.getByLabel("Cor do papel")).toBeVisible();
    await expect(panel.getByRole("group", { name: "Escopo da aparência" })).toBeVisible();
    await expect(panel.getByLabel("Textura").first()).toBeVisible();
    await expect(panel.getByRole("slider", { name: "Intensidade", exact: true })).toBeVisible();
    await expect(panel.getByLabel("Espaçamento")).toBeVisible();
    await waitForVisualStability(page);
    await expectEditorWithinViewport(page);

    await expect(page).toHaveScreenshot("appearance-panel-1440x1200.png");
  });

  test("seletor e criação de template de página", async ({ page }) => {
    await page.setViewportSize({ width: 1_440, height: 900 });
    await openVisualNotebook(page);
    await page.getByRole("button", { name: "Nova página" }).click();
    const dialog = page.getByRole("dialog", { name: "Escolha um template" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Planejamento diário/ })).toBeVisible();
    await waitForVisualStability(page);
    await expect(page).toHaveScreenshot("page-template-picker-1440x900.png");

    await dialog.getByRole("button", { name: /Planejamento diário/ }).click();
    await expect(page.getByText("Planejamento diário", { exact: true })).toBeVisible();
    await waitForVisualStability(page);
    await expect(page).toHaveScreenshot("page-template-daily-planner-1440x900.png");
  });

  test("elemento de texto selecionado", async ({ page }) => {
    await openVisualNotebook(page);
    await page.locator('[data-element-id="visual-journal"]').click();
    await expect(page.locator(".selection-box")).toBeVisible();
    await expect(
      page.getByRole("toolbar", { name: "Formatação do texto" }),
    ).toBeVisible();
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot("selected-text-element-1440x900.png");
  });

  test("elemento de imagem selecionado", async ({ page }) => {
    await openVisualNotebook(page);
    await page.locator('[data-element-id="visual-image"]').click();
    await expect(page.locator(".selection-box")).toBeVisible();
    await expect(page.getByRole("button", { name: "Rotacionar elemento" })).toBeVisible();
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot("selected-image-element-1440x900.png");
  });

  test("insere checklist pela ferramenta selecionada", async ({ page }) => {
    await openVisualNotebook(page);
    await page.getByRole("button", { name: "Checklist" }).click();
    const paper = page.locator('[data-page-id="visual-page-1"]');
    const box = await paper.boundingBox();
    expect(box).not.toBeNull();
    await paper.dispatchEvent("click", {
      clientX: box!.x + box!.width * 0.48,
      clientY: box!.y + box!.height * 0.9,
      detail: 1,
    });

    const checklist = paper.locator(".page-checklist-element");
    await expect(checklist).toHaveCount(1);
    await expect(checklist.getByRole("textbox", { name: "Título da checklist" })).toBeVisible();
    await expect(page.locator(".selection-box")).toBeVisible();
  });

  test("tape extensível com controles de aparência", async ({ page }) => {
    await page.setViewportSize({ width: 1_440, height: 1_100 });
    await openVisualNotebook(page);
    await page.locator('[data-element-id="visual-tape"]').click();
    await page.getByRole("tab", { name: "Aparência" }).click();

    const properties = page.getByLabel("Aparência da tape");
    await expect(properties).toBeVisible();
    await properties.getByRole("button", { name: "Recortar" }).click();
    await properties.getByRole("button", { name: "Rústica" }).click();
    await properties.getByRole("slider", { name: "Opacidade" }).fill("72");

    const renderedTape = page.locator(
      '[data-element-id="visual-tape"] .page-tape-element',
    );
    await expect(renderedTape).toHaveAttribute("data-render-mode", "crop");
    await expect(renderedTape).toHaveAttribute("data-edge", "torn-rough");
    await expect(renderedTape).toHaveCSS("background-repeat", "no-repeat");
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot("tape-properties-1440x1100.png");
  });

  test("checklist interativa com edição e estilos", async ({ page }) => {
    await page.setViewportSize({ width: 1_440, height: 1_050 });
    await openVisualNotebook(page);
    await page.getByRole("button", { name: "Próxima superfície" }).click();
    const frame = page.locator('[data-element-id="visual-page-two-list"]');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute("data-readonly", "false");

    await frame.locator(".checklist-title").click();
    await expect(page.locator(".selection-box")).toBeVisible();
    await page.getByRole("tab", { name: "Aparência" }).click();
    const properties = page.getByLabel("Aparência da checklist");
    await expect(properties).toBeVisible();
    await properties.getByRole("button", { name: "Papel" }).click();
    await properties.getByRole("button", { name: "Quadrado" }).click();
    await frame
      .getByRole("button", { name: "Concluir ajustar tipografia" })
      .click();
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot("checklist-element-1440x1050.png");

    await page.getByRole("button", { name: "Editar no caderno" }).click();
    await expect(frame.getByRole("textbox", { name: "Título da checklist" })).toBeVisible();
    await frame
      .getByRole("button", { name: "Mover revisar alinhamento para baixo" })
      .click();
    const itemValues = await frame
      .locator(".checklist-item-input")
      .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
    expect(itemValues.slice(0, 2)).toEqual([
      "ajustar tipografia",
      "revisar alinhamento",
    ]);
  });

  test("menu da pessoa usuária", async ({ page }) => {
    await openVisualNotebook(page);
    await page.getByRole("button", { name: "Abrir menu do usuário" }).click();
    await expect(page.getByRole("menuitem", { name: "Conta" })).toBeVisible();
    await expectPopoverWithinViewport(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot("user-menu-1440x900.png");
  });

  test("Emoji Picker V2 com busca, categorias e favoritos", async ({ page }) => {
    await openVisualNotebook(page);
    await page.getByRole("button", { name: "Emojis" }).click();
    const picker = page.getByRole("dialog", { name: "Emojis" });
    await expect(picker).toBeVisible();
    await expect(picker.getByLabel("Buscar emojis")).toBeVisible();
    await expect(picker.getByRole("tab", { name: "Rostos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(picker.getByRole("tab", { name: "Símbolos" })).toBeVisible();
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot("emoji-picker-v2-1440x900.png");

    await picker.getByLabel("Buscar emojis").fill("cão");
    const dog = picker.getByRole("button", { name: "Inserir Rosto de cachorro" });
    await expect(dog).toBeVisible();
    await picker
      .getByRole("button", { name: "Adicionar Rosto de cachorro aos favoritos" })
      .click();
    await picker.getByRole("tab", { name: "Favoritos" }).click();
    await expect(dog).toBeVisible();
    await picker.getByLabel("Manter aberto para inserir vários").check();
    await dog.click();

    await expect(picker).toBeVisible();
    await expect(page.locator(".page-emoji-element")).toHaveCount(1);
    await expect(page.locator(".selection-box")).toBeVisible();
  });

  test("asset em processamento na biblioteca", async ({ page }) => {
    await openVisualNotebook(page);
    await page.getByRole("button", { name: "Imagens" }).click();
    const picker = page.getByRole("dialog", { name: "Imagens" });
    await expect(picker).toBeVisible();
    const processingAsset = picker.getByRole("button", {
      name: "Selecionar Imagem em processamento",
    });
    await processingAsset.scrollIntoViewIfNeeded();
    await expect(processingAsset).toHaveAttribute("aria-disabled", "true");
    await expect(processingAsset.locator('[data-availability="processing"]')).toBeVisible();
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot("asset-processing-library-1440x900.png");
  });

  test("placeholder de processamento preserva geometria no editor", async ({ page }) => {
    await openVisualNotebook(page);
    const frame = page.locator('[data-element-id="visual-processing-image"]');
    const placeholder = frame.locator('[data-availability="processing"]');
    await expect(placeholder).toBeVisible();

    const geometry = await frame.evaluate((element) => {
      const frameRect = element.getBoundingClientRect();
      const placeholderElement = element.querySelector<HTMLElement>(
        '[data-availability="processing"]',
      );
      if (!placeholderElement) return null;
      const placeholderRect = placeholderElement.getBoundingClientRect();
      return {
        widthDelta: Math.abs(frameRect.width - placeholderRect.width),
        heightDelta: Math.abs(frameRect.height - placeholderRect.height),
      };
    });
    expect(geometry).not.toBeNull();
    expect(geometry!.widthDelta).toBeLessThanOrEqual(4);
    expect(geometry!.heightDelta).toBeLessThanOrEqual(4);
    await waitForVisualStability(page);

    await expect(frame).toHaveScreenshot("asset-processing-editor.png");
  });
});
