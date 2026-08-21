import type { SidebarAsset } from "../types/document.types";
import type { PageElement, PageElementType } from "../types/element.types";
import type { Bounds, PageSafeArea, Point } from "./coordinates.utils";
import { DEFAULT_SAFE_AREA, pointerToPagePercent } from "./coordinates.utils";
import { createElementFromAsset } from "./element.utils";
import { keepRotatedBoundsInsideSafeArea } from "./elementBounds.utils";
import { placeElementForInsertion } from "./insertion.utils";

export interface DropTargetInfo {
  pageId: string;
  documentId: string;
  rect: DOMRect;
}

export function getElementTypeFromAsset(asset: SidebarAsset): PageElementType {
  switch (asset.category) {
    case "stickers":
      return "sticker";
    case "images":
      return "image";
    case "post-its":
      return "post-it";
    case "tapes":
      return "tape";
  }
}

export function getPageDropTargetFromPoint(
  clientX: number,
  clientY: number,
  root: Document = document,
): DropTargetInfo | null {
  const elements = root.elementsFromPoint?.(clientX, clientY) ?? [root.elementFromPoint(clientX, clientY)];
  const page = elements
    .filter((element): element is Element => Boolean(element))
    .map((element) => element.closest<HTMLElement>("[data-page-id][data-document-id]"))
    .find((element): element is HTMLElement => Boolean(element));
  if (!page) {
    return null;
  }

  return {
    pageId: page.dataset.pageId ?? "",
    documentId: page.dataset.documentId ?? "",
    rect: page.getBoundingClientRect(),
  };
}

export function getCenteredDropBounds(options: {
  pointer: Point;
  element: PageElement;
  safeArea?: PageSafeArea;
}): Bounds {
  const centered = {
    x: options.pointer.x - options.element.width / 2,
    y: options.pointer.y - options.element.height / 2,
    width: options.element.width,
    height: options.element.height,
  };

  return keepRotatedBoundsInsideSafeArea(
    centered,
    options.element.rotation,
    options.safeArea ?? DEFAULT_SAFE_AREA,
  );
}

export function createElementFromAssetDrop(options: {
  asset: SidebarAsset;
  clientX: number;
  clientY: number;
  pageRect: DOMRect;
  existingElements: PageElement[];
  safeArea?: PageSafeArea;
}): PageElement {
  const element = createElementFromAsset(options.asset);
  const pointer = pointerToPagePercent(
    { clientX: options.clientX, clientY: options.clientY },
    options.pageRect,
  );
  const bounds = getCenteredDropBounds({
    pointer,
    element,
    safeArea: options.safeArea,
  });

  return placeElementForInsertion({
    element,
    existingElements: options.existingElements,
    preferredPosition: { x: bounds.x, y: bounds.y },
    safeArea: options.safeArea,
  });
}
