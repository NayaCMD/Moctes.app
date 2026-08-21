import { describe, expect, it } from "vitest";
import { documentSyncQueue } from "../services/sync/documentSyncQueue";
import { createScaleScenario } from "./scaleScenarios";
import {
  runConflictScaleBenchmark,
  runSyncScaleBenchmark,
} from "./syncScaleBenchmark";

describe("sync scale benchmark", () => {
  it("fills and drains an isolated offline queue", async () => {
    const scenario = createScaleScenario("large", {
      pageCount: 3,
      activePageElements: 8,
      elementsPerOtherPage: 2,
      offlineQueueLength: 12,
      conflictCycles: 5,
    });

    const metrics = await runSyncScaleBenchmark({
      queueDocuments: scenario.queueDocuments,
      runId: "unit-test",
    });

    expect(metrics.operationCount).toBe(12);
    expect(metrics.transport).toBe("deterministic-simulated");
    expect(metrics.enqueueMs).toBeGreaterThanOrEqual(0);
    expect(metrics.drainMs).toBeGreaterThanOrEqual(0);
    expect(await documentSyncQueue.list("performance-lab:unit-test")).toEqual(
      [],
    );
  });

  it("repeats and resolves conflict cycles", () => {
    const metrics = runConflictScaleBenchmark(500);

    expect(metrics).toMatchObject({
      cycles: 500,
      transitions: 1_002,
      finalPhase: "synced",
      unresolvedConflicts: 0,
    });
  });
});
