import { expect, type Page, type Route } from "@playwright/test";
import {
  VISUAL_DOCUMENT_ID,
  VISUAL_NOW,
  visualDocumentRecord,
  visualProcessingAsset,
  visualSession,
} from "./visualFixture";

const API_GLOB = "**/api/**";

export async function prepareVisualPage(page: Page): Promise<void> {
  await installDeterministicBrowserState(page);
  await mockVisualApi(page);
  await page.goto("/");

  await expect(
    page.getByRole("region", { name: "Aplicativo Moctes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Todas as alterações foram salvas" }),
  ).toBeVisible();
  await expect(page.getByText("12 de 15 itens", { exact: true })).toBeVisible();

  await page.addStyleTag({
    content: `
      /* Presença e cursores dependem de WebSocket e não pertencem ao fixture visual. */
      .collaboration-presence,
      .remote-cursor-layer {
        display: none !important;
      }

      *, *::before, *::after {
        caret-color: transparent !important;
      }
    `,
  });

  await waitForVisualStability(page);
}

export async function openVisualNotebook(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Abrir caderno" }).click();
  await expect(
    page.getByRole("article", { name: "Caderno de regressão visual" }),
  ).toHaveAttribute("data-book-phase", "open");
  await expect(page.getByLabel("Caderno aberto")).toBeVisible();
  await waitForVisualStability(page);
}

export async function waitForVisualStability(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const visibleImages = [...document.images].filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    await Promise.all(
      visibleImages.map(async (image) => {
        if (!image.complete) {
          await new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          });
        }
        await image.decode().catch(() => undefined);
      }),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

export async function expectEditorWithinViewport(
  page: Page,
  options: { sidebar?: boolean } = {},
): Promise<void> {
  const layout = await page.evaluate(({ checkSidebar }) => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const bounds = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    return {
      viewport,
      bodyOverflowX:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
      toolbar: bounds(".bottom-toolbar"),
      sidebar: checkSidebar ? bounds(".asset-sidebar") : null,
      header: bounds(".app-header"),
    };
  }, { checkSidebar: options.sidebar !== false });

  expect(layout.bodyOverflowX).toBe(false);
  expect(layout.header).not.toBeNull();
  expect(layout.header!.left).toBeGreaterThanOrEqual(0);
  expect(layout.header!.right).toBeLessThanOrEqual(layout.viewport.width + 1);
  expect(layout.toolbar).not.toBeNull();
  expect(layout.toolbar!.left).toBeGreaterThanOrEqual(0);
  expect(layout.toolbar!.right).toBeLessThanOrEqual(layout.viewport.width + 1);
  expect(layout.toolbar!.bottom).toBeLessThanOrEqual(layout.viewport.height + 1);
  if (layout.sidebar) {
    expect(layout.sidebar.left).toBeGreaterThanOrEqual(0);
    expect(layout.sidebar.right).toBeLessThanOrEqual(layout.viewport.width + 1);
    expect(layout.sidebar.bottom).toBeLessThanOrEqual(layout.viewport.height + 1);
  }
}

export async function expectPopoverWithinViewport(page: Page): Promise<void> {
  const popover = await page.locator('[role="menu"]').boundingBox();
  expect(popover).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(popover!.x).toBeGreaterThanOrEqual(0);
  expect(popover!.y).toBeGreaterThanOrEqual(0);
  expect(popover!.x + popover!.width).toBeLessThanOrEqual(viewport!.width);
  expect(popover!.y + popover!.height).toBeLessThanOrEqual(viewport!.height);
}

async function installDeterministicBrowserState(page: Page): Promise<void> {
  await page.addInitScript(({ now }) => {
    const NativeDate = Date;
    const fixedTime = new NativeDate(now).getTime();
    class FixedDate extends NativeDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        super(...(args.length > 0 ? args : [fixedTime]));
      }

      static now() {
        return fixedTime;
      }
    }

    Object.defineProperty(window, "Date", {
      configurable: true,
      value: FixedDate,
    });

    let uuidSequence = 0;
    Object.defineProperty(window.crypto, "randomUUID", {
      configurable: true,
      value: () => {
        uuidSequence += 1;
        return `00000000-0000-4000-8000-${String(uuidSequence).padStart(12, "0")}`;
      },
    });

    window.localStorage.clear();
    window.sessionStorage.clear();
  }, { now: VISUAL_NOW });
}

async function mockVisualApi(page: Page): Promise<void> {
  await page.route("**/socket.io/**", (route) => route.abort("connectionrefused"));
  await page.route(API_GLOB, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders() });
      return;
    }
    if (method === "GET" && url.pathname === "/api/auth/session") {
      await fulfillJson(route, visualSession);
      return;
    }
    if (method === "GET" && url.pathname === "/api/documents") {
      await fulfillJson(route, [visualDocumentRecord]);
      return;
    }
    if (
      method === "GET" &&
      url.pathname === `/api/documents/${VISUAL_DOCUMENT_ID}`
    ) {
      await fulfillJson(route, visualDocumentRecord);
      return;
    }
    if (method === "GET" && url.pathname === "/api/assets") {
      await fulfillJson(route, [visualProcessingAsset]);
      return;
    }
    if (
      method === "GET" &&
      url.pathname === `/api/assets/${visualProcessingAsset.id}`
    ) {
      await fulfillJson(route, visualProcessingAsset);
      return;
    }
    if (method === "GET" && url.pathname === "/api/assets/usage") {
      await fulfillJson(route, {
        usedBytes: 24_000,
        limitBytes: 104_857_600,
        availableBytes: 104_833_600,
        readyBytes: 0,
        pendingBytes: 24_000,
        quarantinedBytes: 0,
        assetCount: 1,
        assetLimit: 500,
        observability: {
          uploadTicketsCreated: 1,
          uploadsCompleted: 1,
          uploadsRejected: 0,
          quotaRejections: 0,
          assetsDeleted: 0,
          lastCleanupAt: VISUAL_NOW,
          lastCleanupDeleted: 0,
          lastCleanupOrphans: 0,
          lastCleanupStatus: "ok",
        },
      });
      return;
    }
    if (
      method === "PUT" &&
      url.pathname === `/api/documents/${VISUAL_DOCUMENT_ID}`
    ) {
      const body = request.postDataJSON() as { document?: unknown };
      await fulfillJson(route, {
        ...visualDocumentRecord,
        version: visualDocumentRecord.version + 1,
        document: body.document ?? visualDocumentRecord.document,
      });
      return;
    }

    await fulfillJson(route, { message: "Visual fixture endpoint not found." }, 404);
  });
}

async function fulfillJson(
  route: Route,
  body: unknown,
  status = 200,
): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders(),
    body: JSON.stringify(body),
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Origin": "http://127.0.0.1:4173",
  };
}
