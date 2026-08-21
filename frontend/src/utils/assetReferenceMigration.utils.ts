import { sidebarAssets } from "../data/assetCatalog";
import type { MoctesDocument } from "../types/document.types";
import type { ElementContent } from "../types/element.types";
import { IMPORTED_ASSET_SRC_PREFIX } from "./assetLibrary.utils";

const builtInSourceById = new Map(
  sidebarAssets.map((asset) => [asset.id, asset.src]),
);

export function canonicalAssetSource(assetId: string): string {
  return (
    builtInSourceById.get(assetId) ?? `${IMPORTED_ASSET_SRC_PREFIX}${assetId}`
  );
}

export function normalizeAssetElementContent(
  content: ElementContent,
): ElementContent {
  if (!isAssetElementContent(content)) {
    return content;
  }
  const src = canonicalAssetSource(content.assetId);
  return content.src === src ? content : { ...content, src };
}

export function migrateDocumentAssetReferences(
  document: MoctesDocument,
): MoctesDocument {
  let changed = false;
  const pages = document.pages.map((page) => {
    let pageChanged = false;
    const elements = page.elements.map((element) => {
      const content = normalizeAssetElementContent(element.content);
      if (content === element.content) {
        return element;
      }
      changed = true;
      pageChanged = true;
      return { ...element, content };
    });
    return pageChanged ? { ...page, elements } : page;
  });
  return changed ? { ...document, pages } : document;
}

export function replaceAssetReferences(
  documents: MoctesDocument[],
  oldAssetId: string,
  newAssetId: string,
): MoctesDocument[] {
  const src = canonicalAssetSource(newAssetId);
  return documents.map((document) => {
    let changed = false;
    const pages = document.pages.map((page) => {
      let pageChanged = false;
      const elements = page.elements.map((element) => {
        if (
          !isAssetElementContent(element.content) ||
          element.content.assetId !== oldAssetId
        ) {
          return element;
        }
        changed = true;
        pageChanged = true;
        return {
          ...element,
          content: {
            ...element.content,
            assetId: newAssetId,
            src,
          },
        };
      });
      return pageChanged ? { ...page, elements } : page;
    });
    return changed ? { ...document, pages } : document;
  });
}

function isAssetElementContent(
  content: ElementContent,
): content is Extract<ElementContent, { kind: "image" | "sticker" | "tape" }> {
  return (
    content.kind === "image" ||
    content.kind === "sticker" ||
    content.kind === "tape"
  );
}
