import { describe, expect, it } from "vitest";
import { assetCatalog } from "../data/assetCatalog";
import type { MoctesDocument } from "../types/document.types";
import {
  migrateDocumentAssetReferences,
  replaceAssetReferences,
} from "./assetReferenceMigration.utils";

describe("asset reference migration", () => {
  it("replaces expiring remote URLs with canonical asset references", () => {
    const document = fixtureDocument(
      "remote-asset",
      "https://storage.example/signed?expires=1",
    );

    const migrated = migrateDocumentAssetReferences(document);

    expect(readReference(migrated)).toEqual({
      assetId: "remote-asset",
      src: "asset://remote-asset",
    });
    expect(migrated).not.toBe(document);
    expect(migrateDocumentAssetReferences(migrated)).toBe(migrated);
  });

  it("refreshes built-in references from the bundled catalog", () => {
    const document = fixtureDocument("tape-blue", "/old-bundle/tape.png");

    expect(readReference(migrateDocumentAssetReferences(document))).toEqual({
      assetId: "tape-blue",
      src: assetCatalog.tapeBlue.src,
    });
  });

  it("moves document references when a local asset receives a server id", () => {
    const document = fixtureDocument("local-asset", "asset://local-asset");

    const migrated = replaceAssetReferences(
      [document],
      "local-asset",
      "server-asset",
    );

    expect(readReference(migrated[0])).toEqual({
      assetId: "server-asset",
      src: "asset://server-asset",
    });
  });
});

function fixtureDocument(assetId: string, src: string): MoctesDocument {
  const now = "2026-08-11T12:00:00.000Z";
  return {
    schemaVersion: 3,
    id: "document-1",
    type: "notepad",
    title: "Offline",
    coverColor: "#fff",
    favorite: false,
    pages: [
      {
        id: "page-1",
        documentId: "document-1",
        order: 1,
        paperType: "blank",
        paperColor: "#fff",
        createdAt: now,
        updatedAt: now,
        elements: [
          {
            id: "element-1",
            type: "image",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            rotation: 0,
            zIndex: 1,
            locked: false,
            hidden: false,
            content: { kind: "image", assetId, src, alt: "Asset" },
            style: {},
          },
        ],
      },
    ],
    dividers: [],
    activePageId: "page-1",
    createdAt: now,
    updatedAt: now,
  };
}

function readReference(document: MoctesDocument) {
  const content = document.pages[0].elements[0].content;
  if (content.kind !== "image") {
    throw new Error("Expected an image reference.");
  }
  return { assetId: content.assetId, src: content.src };
}
