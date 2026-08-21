import { expect, test, type Page } from "@playwright/test";
import {
  expectEditorWithinViewport,
  openVisualNotebook,
  prepareVisualPage,
  waitForVisualStability,
} from "./fixtures/visualTest";

test.use({ hasTouch: true, isMobile: true });

const requestedViewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1_024 },
  { width: 1_024, height: 768 },
] as const;

test.describe("experiência mobile e touch", () => {
  test.beforeEach(async ({ page }) => {
    await prepareVisualPage(page);
  });

  test("mantém a interface utilizável na matriz de viewports", async ({ page }) => {
    for (const viewport of requestedViewports) {
      await page.setViewportSize(viewport);
      await waitForVisualStability(page);
      await expectEditorWithinViewport(page, { sidebar: false });

      await expect(page.locator(".app-header")).toHaveAttribute(
        "aria-label",
        "Cabeçalho do Moctes",
      );
      await expect(page.getByRole("toolbar", { name: "Ferramentas" })).toBeVisible();
      if (viewport.width <= 900) {
        await expect(page.getByRole("button", { name: "Abrir biblioteca" })).toBeVisible();
      } else {
        await expect(page.getByRole("button", { name: "Texto" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Imagens" })).toBeVisible();
      }

      const layout = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        headerHeight: document.querySelector<HTMLElement>(".app-header")?.getBoundingClientRect().height,
        toolbarHeight: document.querySelector<HTMLElement>(".bottom-toolbar")?.getBoundingClientRect().height,
      }));
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
      expect(layout.headerHeight).toBeGreaterThanOrEqual(52);
      expect(layout.toolbarHeight).toBeGreaterThanOrEqual(56);
    }
  });

  test("prioriza ferramentas essenciais e apresenta as demais em uma sheet", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openVisualNotebook(page);

    const toolbar = page.getByRole("toolbar", { name: "Ferramentas" });
    await expect(toolbar.getByRole("button", { name: "Texto" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Imagens" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Caneta e régua" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Formas e stickers" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Abrir biblioteca" })).toBeVisible();
    await expect(toolbar.getByRole("button", { name: "Emojis" })).toHaveCount(0);

    await toolbar.getByRole("button", { name: "Mais ferramentas" }).click();
    const sheet = page.getByRole("dialog", { name: "Mais ferramentas" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Emojis" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Nova página" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Apagar" })).toBeVisible();
    await expectBottomSheetWithinViewport(page, sheet.locator(".."));
  });

  test("seleciona primeiro, move no segundo gesto e abre propriedades", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openVisualNotebook(page);

    const element = page.locator('[data-element-id="visual-journal"]');
    const initialPosition = await readPercentPosition(element);
    const elementBox = await element.boundingBox();
    expect(elementBox).not.toBeNull();

    await page.touchscreen.tap(
      elementBox!.x + elementBox!.width / 2,
      elementBox!.y + elementBox!.height / 2,
    );
    await expect(page.locator(".selection-box")).toBeVisible();
    expect(await readPercentPosition(element)).toEqual(initialPosition);

    await dispatchTouchDrag(page, element, 34, 22);
    const movedPosition = await readPercentPosition(element);
    expect(
      Math.abs(movedPosition.left - initialPosition.left) +
        Math.abs(movedPosition.top - initialPosition.top),
    ).toBeGreaterThan(0.5);

    await page.getByRole("button", { name: "Propriedades" }).click();
    const inspector = page.getByRole("tabpanel", { name: "Aparência" });
    await expect(inspector).toBeVisible();
    await expect(inspector.getByLabel("Conteúdo do elemento")).toBeVisible();
    await expectBottomSheetWithinViewport(page, page.locator(".asset-sidebar"));

    await inspector.getByRole("button", { name: "Editar no caderno" }).click();
    const editor = page.getByRole("textbox", { name: "Editar texto" });
    await expect(editor).toBeVisible();
    await expect(editor).toBeFocused();
  });

  test("pinch altera o zoom uma vez e pan percorre o canvas ampliado", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openVisualNotebook(page);

    const stage = page.getByLabel("Área navegável do documento");
    const beforeZoom = await readZoomPercentage(page);
    await dispatchPinch(page, stage, 50);
    const afterZoom = await readZoomPercentage(page);
    expect(afterZoom).toBeGreaterThan(beforeZoom);

    const beforeScroll = await stage.evaluate((element) => ({
      left: element.scrollLeft,
      top: element.scrollTop,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
    expect(beforeScroll.scrollWidth).toBeGreaterThan(beforeScroll.clientWidth);
    await dispatchTouchDrag(page, stage, -70, -35, { xRatio: 0.12, yRatio: 0.45 });
    const afterScroll = await stage.evaluate((element) => ({
      left: element.scrollLeft,
      top: element.scrollTop,
    }));
    expect(afterScroll.left + afterScroll.top).toBeGreaterThan(
      beforeScroll.left + beforeScroll.top,
    );
  });

  test("navega entre superfícies por controles touch", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openVisualNotebook(page);

    const indicator = page.locator(".notebook-navigation-indicator");
    const before = await indicator.getAttribute("aria-label");
    await page.getByRole("button", { name: "Próxima superfície" }).click();
    await expect(indicator).not.toHaveAttribute("aria-label", before ?? "");
  });

  test("snapshot do editor touch em 390x844", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openVisualNotebook(page);
    await expectEditorWithinViewport(page, { sidebar: false });

    await expect(page).toHaveScreenshot("mobile-editor-open-390x844.png");
  });

  test("snapshot do inspector mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openVisualNotebook(page);
    await selectElementWithTouch(page, "visual-journal");
    await page.getByRole("button", { name: "Propriedades" }).click();
    await expect(page.getByRole("tabpanel", { name: "Aparência" })).toBeVisible();
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot("mobile-inspector-390x844.png");
  });

  test("snapshot do editor touch em landscape", async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await openVisualNotebook(page);
    await page.getByRole("button", { name: "Imagens" }).click();
    await expect(page.getByRole("dialog", { name: "Imagens" })).toBeVisible();
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot("mobile-image-sheet-844x390.png");
  });
});

async function selectElementWithTouch(page: Page, elementId: string) {
  const element = page.locator(`[data-element-id="${elementId}"]`);
  const box = await element.boundingBox();
  expect(box).not.toBeNull();
  await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(element).toHaveAttribute("data-selected", "true");
}

async function readPercentPosition(locator: ReturnType<Page["locator"]>) {
  return locator.evaluate((element) => ({
    left: Number.parseFloat((element as HTMLElement).style.left),
    top: Number.parseFloat((element as HTMLElement).style.top),
  }));
}

async function readZoomPercentage(page: Page) {
  const text = await page.locator(".editor-zoom-value").textContent();
  return Number.parseInt(text ?? "0", 10);
}

async function dispatchTouchDrag(
  page: Page,
  target: ReturnType<Page["locator"]>,
  deltaX: number,
  deltaY: number,
  ratios: { xRatio: number; yRatio: number } = { xRatio: 0.5, yRatio: 0.5 },
) {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  const startX = box!.x + box!.width * ratios.xRatio;
  const startY = box!.y + box!.height * ratios.yRatio;
  await target.dispatchEvent("pointerdown", {
    bubbles: true,
    button: 0,
    buttons: 1,
    clientX: startX,
    clientY: startY,
    isPrimary: true,
    pointerId: 31,
    pointerType: "touch",
  });
  await page.evaluate(({ clientX, clientY }) => {
    window.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      buttons: 1,
      clientX,
      clientY,
      isPrimary: true,
      pointerId: 31,
      pointerType: "touch",
    }));
    window.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      button: 0,
      clientX,
      clientY,
      isPrimary: true,
      pointerId: 31,
      pointerType: "touch",
    }));
  }, { clientX: startX + deltaX, clientY: startY + deltaY });
}

async function dispatchPinch(
  page: Page,
  stage: ReturnType<Page["locator"]>,
  expansion: number,
) {
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;

  await stage.dispatchEvent("pointerdown", {
    bubbles: true,
    buttons: 1,
    clientX: centerX - 35,
    clientY: centerY,
    isPrimary: true,
    pointerId: 41,
    pointerType: "touch",
  });
  await stage.dispatchEvent("pointerdown", {
    bubbles: true,
    buttons: 1,
    clientX: centerX + 35,
    clientY: centerY,
    isPrimary: false,
    pointerId: 42,
    pointerType: "touch",
  });
  await page.evaluate(({ centerX, centerY, expansion }) => {
    window.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      buttons: 1,
      clientX: centerX - 35 - expansion,
      clientY: centerY,
      isPrimary: true,
      pointerId: 41,
      pointerType: "touch",
    }));
    window.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      buttons: 1,
      clientX: centerX + 35 + expansion,
      clientY: centerY,
      isPrimary: false,
      pointerId: 42,
      pointerType: "touch",
    }));
    for (const pointerId of [41, 42]) {
      window.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        clientX: centerX,
        clientY: centerY,
        isPrimary: pointerId === 41,
        pointerId,
        pointerType: "touch",
      }));
    }
  }, { centerX, centerY, expansion });
}

async function expectBottomSheetWithinViewport(
  page: Page,
  sheet: ReturnType<Page["locator"]>,
) {
  const box = await sheet.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
}
