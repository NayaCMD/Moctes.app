import { describe, expect, it } from "vitest";
import {
  calculateRetryDelay,
  initialDocumentSyncMachineState,
  reduceDocumentSyncState,
} from "./documentSyncMachine";

describe("document sync machine", () => {
  it("moves from bootstrap through queue, sync and success", () => {
    const bootstrapping = reduceDocumentSyncState(
      initialDocumentSyncMachineState,
      { type: "START" },
    );
    expect(bootstrapping.phase).toBe("bootstrapping");
    expect(
      reduceDocumentSyncState(bootstrapping, {
        type: "QUEUE_CHANGED",
        pendingOperations: 2,
      }),
    ).toMatchObject({ phase: "bootstrapping", pendingOperations: 2 });

    const queued = reduceDocumentSyncState(bootstrapping, {
      type: "BOOTSTRAP_COMPLETE",
      pendingOperations: 2,
    });
    expect(queued).toMatchObject({ phase: "queued", pendingOperations: 2 });

    const syncing = reduceDocumentSyncState(queued, {
      type: "SYNC_STARTED",
      pendingOperations: 2,
    });
    expect(syncing.phase).toBe("syncing");

    const synced = reduceDocumentSyncState(syncing, {
      type: "SYNC_SUCCEEDED",
      pendingOperations: 0,
      at: "2026-08-11T12:00:00.000Z",
    });
    expect(synced).toMatchObject({
      phase: "synced",
      pendingOperations: 0,
      retryAttempt: 0,
      lastSyncedAt: "2026-08-11T12:00:00.000Z",
    });
  });

  it("keeps queued work while offline and exposes its retry deadline", () => {
    const waiting = reduceDocumentSyncState(initialDocumentSyncMachineState, {
      type: "RETRY_SCHEDULED",
      pendingOperations: 3,
      attempt: 2,
      nextRetryAt: "2026-08-11T12:00:04.000Z",
      error: "Unavailable",
    });
    expect(waiting).toMatchObject({
      phase: "waiting-retry",
      pendingOperations: 3,
      retryAttempt: 2,
    });

    const offline = reduceDocumentSyncState(waiting, {
      type: "NETWORK_OFFLINE",
      pendingOperations: 3,
      error: "Offline",
    });
    expect(offline).toMatchObject({
      phase: "offline",
      pendingOperations: 3,
      error: "Offline",
    });
  });

  it("removes only the resolved conflict and resumes the queue", () => {
    const firstConflict = reduceDocumentSyncState(
      initialDocumentSyncMachineState,
      {
        type: "CONFLICT",
        documentId: "document-1",
        operationId: "operation-1",
        error: "Version conflict",
      },
    );
    const secondConflict = reduceDocumentSyncState(firstConflict, {
      type: "CONFLICT",
      documentId: "document-2",
      operationId: "operation-2",
      error: "Version conflict",
    });

    const stillConflicted = reduceDocumentSyncState(secondConflict, {
      type: "CONFLICT_RESOLVED",
      documentId: "document-1",
      pendingOperations: 1,
    });
    expect(stillConflicted).toMatchObject({
      phase: "conflict",
      pendingOperations: 1,
      conflictDocumentIds: ["document-2"],
      conflictOperationIds: { "document-2": "operation-2" },
    });

    const resumed = reduceDocumentSyncState(stillConflicted, {
      type: "CONFLICT_RESOLVED",
      documentId: "document-2",
      pendingOperations: 1,
    });
    expect(resumed).toMatchObject({
      phase: "queued",
      pendingOperations: 1,
      error: null,
      conflictDocumentIds: [],
    });
  });

  it("uses capped exponential backoff with bounded jitter", () => {
    expect(calculateRetryDelay(1, () => 0.5)).toBe(1_000);
    expect(calculateRetryDelay(3, () => 0.5)).toBe(4_000);
    expect(calculateRetryDelay(20, () => 0.5)).toBe(60_000);
    expect(calculateRetryDelay(1, () => 0)).toBe(800);
    expect(calculateRetryDelay(1, () => 1)).toBe(1_200);
  });
});
