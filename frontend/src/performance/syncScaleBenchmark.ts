import { documentSyncQueue } from "../services/sync/documentSyncQueue";
import {
  initialDocumentSyncMachineState,
  reduceDocumentSyncState,
} from "../services/sync/documentSyncMachine";
import type { MoctesDocument } from "../types/document.types";
import { round } from "./performanceMetrics";

export interface SyncScaleMetrics {
  operationCount: number;
  enqueueMs: number;
  queueReadMs: number;
  drainMs: number;
  operationsPerSecond: number;
  transport: "deterministic-simulated";
  simulatedTransportLatencyMs: number;
}

export interface ConflictScaleMetrics {
  cycles: number;
  transitions: number;
  durationMs: number;
  transitionsPerSecond: number;
  finalPhase: string;
  unresolvedConflicts: number;
}

export async function runSyncScaleBenchmark(options: {
  queueDocuments: MoctesDocument[];
  runId: string;
  simulatedTransportLatencyMs?: number;
}): Promise<SyncScaleMetrics> {
  const {
    queueDocuments,
    runId,
    simulatedTransportLatencyMs = 0,
  } = options;
  const scope = `performance-lab:${runId}`;
  const workspaceId = `performance-workspace:${runId}`;

  const enqueueStartedAt = performance.now();
  for (const batch of chunk(queueDocuments, 25)) {
    await Promise.all(
      batch.map((document) =>
        documentSyncQueue.enqueueUpsert(scope, workspaceId, document),
      ),
    );
  }
  const enqueueMs = performance.now() - enqueueStartedAt;

  const readStartedAt = performance.now();
  const operations = await documentSyncQueue.list(scope);
  const queueReadMs = performance.now() - readStartedAt;

  const drainStartedAt = performance.now();
  try {
    for (const operation of operations) {
      if (simulatedTransportLatencyMs > 0) {
        await delay(simulatedTransportLatencyMs);
      }
      await documentSyncQueue.removeIfRevision(
        operation.id,
        operation.revision,
      );
    }
  } finally {
    await cleanupScope(scope);
  }
  const drainMs = performance.now() - drainStartedAt;

  return {
    operationCount: operations.length,
    enqueueMs: round(enqueueMs),
    queueReadMs: round(queueReadMs),
    drainMs: round(drainMs),
    operationsPerSecond: round(
      drainMs > 0 ? (operations.length / drainMs) * 1_000 : 0,
    ),
    transport: "deterministic-simulated",
    simulatedTransportLatencyMs,
  };
}

export function runConflictScaleBenchmark(cycles: number): ConflictScaleMetrics {
  const startedAt = performance.now();
  let state = reduceDocumentSyncState(initialDocumentSyncMachineState, {
    type: "START",
  });
  state = reduceDocumentSyncState(state, {
    type: "BOOTSTRAP_COMPLETE",
    pendingOperations: cycles,
  });
  let transitions = 2;

  for (let index = 0; index < cycles; index += 1) {
    const documentId = `performance-conflict-${index}`;
    state = reduceDocumentSyncState(state, {
      type: "CONFLICT",
      documentId,
      operationId: `performance-operation-${index}`,
      error: "Conflito deterministico de benchmark",
    });
    state = reduceDocumentSyncState(state, {
      type: "CONFLICT_RESOLVED",
      documentId,
      pendingOperations: cycles - index - 1,
    });
    transitions += 2;
  }

  const durationMs = performance.now() - startedAt;
  return {
    cycles,
    transitions,
    durationMs: round(durationMs),
    transitionsPerSecond: round(
      durationMs > 0 ? (transitions / durationMs) * 1_000 : 0,
    ),
    finalPhase: state.phase,
    unresolvedConflicts: state.conflictDocumentIds.length,
  };
}

async function cleanupScope(scope: string): Promise<void> {
  const remaining = await documentSyncQueue.list(scope);
  await Promise.all(
    remaining.map((operation) =>
      documentSyncQueue.removeIfRevision(operation.id, operation.revision),
    ),
  );
}

function chunk<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}
