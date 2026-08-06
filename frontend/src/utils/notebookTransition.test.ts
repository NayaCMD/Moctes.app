import { describe, expect, it } from "vitest";
import type { NotebookSurface } from "../types/notebook.types";
import {
  getNotebookTransitionDirection,
  getSurfaceOffsetTarget,
} from "./notebookTransition.utils";

const surfaces: NotebookSurface[] = [
  {
    kind: "divider",
    id: "divider-a",
    sectionId: "section-a",
    divider: {
      id: "divider-a",
      color: "#fff",
      tabColor: "#ddd",
      textColor: "#111",
      tabPosition: 0,
    },
  },
  {
    kind: "page",
    id: "page-a1",
    sectionId: "section-a",
    page: {
      id: "page-a1",
      documentId: "doc",
      dividerId: "divider-a",
      title: "Page A1",
      order: 1,
      paperType: "dotted",
      paperColor: "#fffdf8",
      patternColor: "#72a0b9",
      patternOpacity: 14,
      patternSize: 18,
      elements: [],
      createdAt: "2026-08-06T00:00:00.000Z",
      updatedAt: "2026-08-06T00:00:00.000Z",
    },
  },
  {
    kind: "divider",
    id: "divider-b",
    sectionId: "section-b",
    divider: {
      id: "divider-b",
      color: "#fff",
      tabColor: "#ddd",
      textColor: "#111",
      tabPosition: 0,
    },
  },
];

describe("notebook transition helpers", () => {
  it("determina a direcao pela ordem estrutural", () => {
    expect(getNotebookTransitionDirection(surfaces, "divider-a", "page-a1")).toBe("forward");
    expect(getNotebookTransitionDirection(surfaces, "divider-b", "page-a1")).toBe("backward");
  });

  it("ignora destino igual ou invalido", () => {
    expect(getNotebookTransitionDirection(surfaces, "page-a1", "page-a1")).toBeNull();
    expect(getNotebookTransitionDirection(surfaces, "page-a1", "missing")).toBeNull();
    expect(getNotebookTransitionDirection(surfaces, "missing", "page-a1")).toBeNull();
  });

  it("localiza superficies vizinhas sem ultrapassar limites", () => {
    expect(getSurfaceOffsetTarget(surfaces, "divider-a", 1)?.id).toBe("page-a1");
    expect(getSurfaceOffsetTarget(surfaces, "divider-b", -1)?.id).toBe("page-a1");
    expect(getSurfaceOffsetTarget(surfaces, "divider-a", -1)).toBeUndefined();
    expect(getSurfaceOffsetTarget(surfaces, "divider-b", 1)).toBeUndefined();
  });
});
