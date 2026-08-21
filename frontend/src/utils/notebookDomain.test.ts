import { describe, expect, it } from "vitest";
import type { Divider, MoctesDocument } from "../types/document.types";
import type { PageElement } from "../types/element.types";
import type { NotebookSection } from "../types/notebook.types";
import type { Page } from "../types/page.types";
import { createEmptyDocument } from "./document.utils";
import { migrateDocumentToSchemaV3 } from "./notebookMigration.utils";
import {
  buildNotebookSurfaces,
  getPagesInSection,
  getSectionByPageId,
  getSurfaceById,
} from "./notebookSurfaces.utils";
import { validateNotebookDocument } from "./notebookValidation.utils";

const now = "2026-08-05T00:00:00.000Z";

function textElement(id: string): PageElement {
  return {
    id,
    type: "text",
    x: 10,
    y: 10,
    width: 20,
    height: 10,
    rotation: 0,
    zIndex: 1,
    locked: false,
    hidden: false,
    content: { kind: "text", text: "Conteudo preservado" },
    style: {},
  };
}

function page(id: string, order: number, dividerId?: string, elements: PageElement[] = []): Page {
  return {
    id,
    documentId: "doc-legacy",
    dividerId,
    title: id,
    order,
    paperType: "dotted",
    paperColor: "#fffdf8",
    patternColor: "#72a0b9",
    patternOpacity: 14,
    patternSize: 18,
    elements,
    createdAt: now,
    updatedAt: now,
  };
}

function divider(id: string, name: string, order: number): Divider {
  return {
    id,
    documentId: "doc-legacy",
    name,
    color: "#d9f4f7",
    order,
  };
}

function legacyNotebook(overrides: Partial<MoctesDocument> = {}): MoctesDocument {
  const dividers = [divider("divider-front", "Front-end", 1), divider("divider-back", "Back-end", 2)];
  const pages = [
    page("page-react", 1, "divider-front", [textElement("el-react")]),
    page("page-css", 2, "divider-front"),
    page("page-node", 3, "divider-back"),
  ];

  return {
    id: "doc-legacy",
    type: "notebook",
    title: "Caderno legado",
    coverColor: "#bde4eb",
    coverBorderColor: "#8dcbd7",
    favorite: false,
    pages,
    dividers,
    activePageId: "page-css",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("notebook v3 domain", () => {
  it("cria um documento v3 valido", () => {
    const document = createEmptyDocument("notebook");

    expect(document.schemaVersion).toBe(3);
    expect(document.cover).toMatchObject({ color: "#bde4eb", borderColor: "#8dcbd7" });
    expect(document.sections).toHaveLength(1);
    expect(document.sections?.[0].divider).toBeDefined();
    expect(getPagesInSection(document, document.sections![0].id)).toHaveLength(1);
    expect(document.activeSurfaceId).toBe(document.activePageId);
    expect(validateNotebookDocument(document).valid).toBe(true);
  });

  it("migra documento antigo com paginas e divisorias preservando IDs e elementos", () => {
    const legacy = legacyNotebook();
    const migrated = migrateDocumentToSchemaV3(legacy);

    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.pages.map((item) => item.id)).toEqual(["page-react", "page-css", "page-node"]);
    expect(migrated.pages[0].elements[0].id).toBe("el-react");
    expect(migrated.pages[0].sectionId).toBe("section-divider-front");
    expect(migrated.pages[0].dividerId).toBeUndefined();
    expect(migrated.sections?.map((section) => section.title)).toEqual(["Front-end", "Back-end"]);
    expect(migrated.activeSurfaceId).toBe("page-css");
    expect(validateNotebookDocument(migrated).valid).toBe(true);
  });

  it("move pagina sem divisoria para uma secao padrao", () => {
    const legacy = legacyNotebook({
      pages: [page("page-loose", 1), page("page-front", 2, "divider-front")],
      activePageId: "page-loose",
    });
    const migrated = migrateDocumentToSchemaV3(legacy);
    const defaultSection = migrated.sections?.find((section) => section.title === "Anotações");

    expect(getPagesInSection(migrated, defaultSection!.id).map((item) => item.id)).toEqual([
      "page-loose",
    ]);
    expect(migrated.pages.find((item) => item.id === "page-loose")?.sectionId).toBe(
      defaultSection?.id,
    );
    expect(validateNotebookDocument(migrated).valid).toBe(true);
  });

  it("nao duplica paginas e a migracao e idempotente", () => {
    const firstMigration = migrateDocumentToSchemaV3(legacyNotebook());
    const secondMigration = migrateDocumentToSchemaV3(firstMigration);
    const pageIds = firstMigration.pages.map((item) => item.id);

    expect(new Set(pageIds).size).toBe(pageIds.length);
    expect(secondMigration).toEqual(firstMigration);
  });

  it("gera superficies com divisoria antes das paginas da secao", () => {
    const migrated = migrateDocumentToSchemaV3(legacyNotebook());
    const surfaces = buildNotebookSurfaces(migrated);

    expect(surfaces.map((surface) => `${surface.kind}:${surface.id}`)).toEqual([
      "divider:divider-front",
      "page:page-react",
      "page:page-css",
      "divider:divider-back",
      "page:page-node",
    ]);
    expect(getSurfaceById(migrated, "page-node")?.kind).toBe("page");
    expect(getSectionByPageId(migrated, "page-react")?.id).toBe("section-divider-front");
  });

  it("valida activeSurfaceId existente", () => {
    const migrated = migrateDocumentToSchemaV3(legacyNotebook({ activePageId: "missing-page" }));

    expect(migrated.activeSurfaceId).toBe("page-react");
    expect(validateNotebookDocument({ ...migrated, activeSurfaceId: "missing-surface" }).errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "INVALID_ACTIVE_SURFACE" })]),
    );
  });

  it("rejeita paginas orfas", () => {
    const migrated = migrateDocumentToSchemaV3(legacyNotebook());
    const invalid = {
      ...migrated,
      pages: migrated.pages.map((item) =>
        item.id === "page-node" ? { ...item, sectionId: "missing-section" } : item,
      ),
    };

    expect(validateNotebookDocument(invalid).errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "ORPHAN_PAGE", id: "page-node" })]),
    );
  });

  it("rejeita paginas duplicadas", () => {
    const migrated = migrateDocumentToSchemaV3(legacyNotebook());
    const duplicatePage = migrated.pages[0];
    const invalid = {
      ...migrated,
      pages: [...migrated.pages, duplicatePage],
    };

    expect(validateNotebookDocument(invalid).errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "DUPLICATE_PAGE", id: "page-react" })]),
    );
  });

  it("rejeita IDs duplicados", () => {
    const migrated = migrateDocumentToSchemaV3(legacyNotebook());
    const invalid = {
      ...migrated,
      sections: migrated.sections?.map((section, index) =>
        index === 0 ? { ...section, id: "page-react" } : section,
      ),
    };

    expect(validateNotebookDocument(invalid).errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "DUPLICATE_ID", id: "page-react" })]),
    );
  });

  it("rejeita secao sem divisoria", () => {
    const migrated = migrateDocumentToSchemaV3(legacyNotebook());
    const brokenSection = {
      id: "section-broken",
      title: "Quebrada",
    } as unknown as NotebookSection;
    const invalid = {
      ...migrated,
      sections: [...(migrated.sections ?? []), brokenSection],
    };

    expect(validateNotebookDocument(invalid).errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "MISSING_DIVIDER", id: "section-broken" })]),
    );
  });

  it("rejeita divisoria solta fora das secoes", () => {
    const migrated = migrateDocumentToSchemaV3(legacyNotebook());
    const invalid = {
      ...migrated,
      dividers: [...migrated.dividers, divider("divider-loose", "Solta", 3)],
    };

    expect(validateNotebookDocument(invalid).errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "LOOSE_DIVIDER", id: "divider-loose" })]),
    );
  });

  it("mantem campos antigos utilizaveis durante a transicao", () => {
    const migrated = migrateDocumentToSchemaV3(legacyNotebook());

    expect(migrated.pages).toHaveLength(3);
    expect(migrated.dividers.map((item) => item.id)).toEqual(["divider-front", "divider-back"]);
    expect(migrated.activePageId).toBe("page-css");
  });
});
