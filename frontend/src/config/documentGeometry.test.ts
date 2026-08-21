import { describe, expect, it } from "vitest";
import {
  calculateDocumentViewport,
  DOCUMENT_GEOMETRY,
  MAX_FIT_SCALE,
} from "./documentGeometry";

describe("calculateDocumentViewport", () => {
  it("uses extra space on large screens without exceeding the fit limit", () => {
    const viewport = calculateDocumentViewport(
      { width: 1508, height: 920 },
      DOCUMENT_GEOMETRY.notebook,
    );

    expect(viewport.scale).toBeGreaterThan(1);
    expect(viewport.scale).toBeLessThanOrEqual(MAX_FIT_SCALE);
    expect(viewport.availableHeight - viewport.renderedHeight).toBeLessThan(4);
    expect(viewport.requiresHorizontalPan).toBe(false);
    expect(viewport.requiresVerticalPan).toBe(false);
  });

  it("continues fitting the notebook inside an ordinary desktop viewport", () => {
    const viewport = calculateDocumentViewport(
      { width: 1009, height: 574 },
      DOCUMENT_GEOMETRY.notebook,
    );

    expect(viewport.scale).toBeLessThan(1);
    expect(viewport.renderedHeight).toBeCloseTo(viewport.availableHeight);
    expect(viewport.requiresHorizontalPan).toBe(false);
  });
});
