import { describe, expect, it } from "vitest";
import { measureSerializedBytes } from "./performanceMetrics";
import { createScaleScenario, SCALE_PROFILES } from "./scaleScenarios";

describe("scale scenarios", () => {
  it("builds the large scenario with hundreds of pages and thousands of elements", () => {
    const scenario = createScaleScenario("large");

    expect(scenario.summary).toMatchObject({
      pages: 300,
      elements: 5_484,
      activePageElements: 700,
      offlineQueueOperations: 500,
      conflictCycles: 250,
    });
    expect(scenario.summary.imageElements).toBeGreaterThan(1_000);
    expect(scenario.document.pages).toHaveLength(300);
    expect(measureSerializedBytes(scenario.document)).toBeGreaterThan(
      1_000_000,
    );
  });

  it("is deterministic for a profile and seed", () => {
    const overrides = {
      pageCount: 4,
      activePageElements: 12,
      elementsPerOtherPage: 3,
      offlineQueueLength: 4,
      conflictCycles: 3,
    };

    const first = createScaleScenario("large", overrides);
    const second = createScaleScenario("large", overrides);

    expect(second.document).toEqual(first.document);
    expect(second.queueDocuments).toEqual(first.queueDocuments);
    expect(second.summary).toEqual(first.summary);
  });

  it("keeps the extreme profile materially above the large profile", () => {
    expect(SCALE_PROFILES.extreme.pageCount).toBeGreaterThan(
      SCALE_PROFILES.large.pageCount,
    );
    expect(SCALE_PROFILES.extreme.activePageElements).toBeGreaterThan(
      SCALE_PROFILES.large.activePageElements,
    );
    expect(SCALE_PROFILES.extreme.offlineQueueLength).toBeGreaterThan(
      SCALE_PROFILES.large.offlineQueueLength,
    );
  });

  it("rejects invalid scenario sizes", () => {
    expect(() =>
      createScaleScenario("large", { pageCount: 0 }),
    ).toThrow("pageCount");
    expect(() =>
      createScaleScenario("large", { imageRatio: 2 }),
    ).toThrow("imageRatio");
  });
});
