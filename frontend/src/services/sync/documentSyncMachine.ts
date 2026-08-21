export type DocumentSyncPhase =
  | "idle"
  | "bootstrapping"
  | "queued"
  | "syncing"
  | "synced"
  | "waiting-retry"
  | "offline"
  | "conflict"
  | "error";

export interface DocumentSyncMachineState {
  phase: DocumentSyncPhase;
  pendingOperations: number;
  retryAttempt: number;
  nextRetryAt: string | null;
  lastSyncedAt: string | null;
  error: string | null;
  conflictDocumentIds: string[];
  conflictOperationIds: Record<string, string>;
}

export type DocumentSyncEvent =
  | { type: "START" }
  | { type: "BOOTSTRAP_COMPLETE"; pendingOperations: number }
  | { type: "QUEUE_CHANGED"; pendingOperations: number }
  | { type: "SYNC_STARTED"; pendingOperations: number }
  | { type: "SYNC_SUCCEEDED"; pendingOperations: number; at: string }
  | {
      type: "RETRY_SCHEDULED";
      pendingOperations: number;
      attempt: number;
      nextRetryAt: string;
      error: string;
    }
  | { type: "NETWORK_OFFLINE"; pendingOperations: number; error: string }
  | { type: "NETWORK_ONLINE"; pendingOperations: number }
  | { type: "RETRY_REQUESTED"; pendingOperations: number }
  | {
      type: "CONFLICT";
      documentId: string;
      operationId: string;
      error: string;
    }
  | {
      type: "CONFLICT_RESOLVED";
      documentId: string;
      pendingOperations: number;
    }
  | { type: "FATAL_ERROR"; error: string }
  | { type: "STOP" };

export const initialDocumentSyncMachineState: DocumentSyncMachineState = {
  phase: "idle",
  pendingOperations: 0,
  retryAttempt: 0,
  nextRetryAt: null,
  lastSyncedAt: null,
  error: null,
  conflictDocumentIds: [],
  conflictOperationIds: {},
};

export function reduceDocumentSyncState(
  state: DocumentSyncMachineState,
  event: DocumentSyncEvent,
): DocumentSyncMachineState {
  switch (event.type) {
    case "START":
      return {
        ...initialDocumentSyncMachineState,
        phase: "bootstrapping",
        lastSyncedAt: state.lastSyncedAt,
      };
    case "BOOTSTRAP_COMPLETE":
      return {
        ...state,
        phase: event.pendingOperations > 0 ? "queued" : "synced",
        pendingOperations: event.pendingOperations,
        retryAttempt: 0,
        nextRetryAt: null,
        error: null,
        conflictDocumentIds: [],
        conflictOperationIds: {},
      };
    case "QUEUE_CHANGED":
      return {
        ...state,
        phase: queueChangedPhase(state.phase, event.pendingOperations),
        pendingOperations: event.pendingOperations,
      };
    case "SYNC_STARTED":
      return {
        ...state,
        phase: "syncing",
        pendingOperations: event.pendingOperations,
        nextRetryAt: null,
        error: null,
      };
    case "SYNC_SUCCEEDED":
      return {
        ...state,
        phase: event.pendingOperations > 0 ? "queued" : "synced",
        pendingOperations: event.pendingOperations,
        retryAttempt: 0,
        nextRetryAt: null,
        lastSyncedAt: event.at,
        error: null,
        conflictDocumentIds: [],
        conflictOperationIds: {},
      };
    case "RETRY_SCHEDULED":
      return {
        ...state,
        phase: "waiting-retry",
        pendingOperations: event.pendingOperations,
        retryAttempt: event.attempt,
        nextRetryAt: event.nextRetryAt,
        error: event.error,
      };
    case "NETWORK_OFFLINE":
      return {
        ...state,
        phase: "offline",
        pendingOperations: event.pendingOperations,
        nextRetryAt: null,
        error: event.error,
      };
    case "NETWORK_ONLINE":
      return {
        ...state,
        phase: event.pendingOperations > 0 ? "queued" : "synced",
        pendingOperations: event.pendingOperations,
        nextRetryAt: null,
        error: null,
      };
    case "RETRY_REQUESTED":
      return {
        ...state,
        phase: event.pendingOperations > 0 ? "queued" : "bootstrapping",
        pendingOperations: event.pendingOperations,
        retryAttempt: 0,
        nextRetryAt: null,
        error: null,
        conflictDocumentIds: [],
        conflictOperationIds: {},
      };
    case "CONFLICT":
      return {
        ...state,
        phase: "conflict",
        error: event.error,
        conflictDocumentIds: [
          ...new Set([...state.conflictDocumentIds, event.documentId]),
        ],
        conflictOperationIds: {
          ...state.conflictOperationIds,
          [event.documentId]: event.operationId,
        },
      };
    case "CONFLICT_RESOLVED": {
      const remainingConflicts = state.conflictDocumentIds.filter(
        (documentId) => documentId !== event.documentId,
      );
      const conflictOperationIds = { ...state.conflictOperationIds };
      delete conflictOperationIds[event.documentId];
      return {
        ...state,
        phase:
          remainingConflicts.length > 0
            ? "conflict"
            : event.pendingOperations > 0
              ? "queued"
              : "synced",
        pendingOperations: event.pendingOperations,
        error: remainingConflicts.length > 0 ? state.error : null,
        conflictDocumentIds: remainingConflicts,
        conflictOperationIds,
      };
    }
    case "FATAL_ERROR":
      return { ...state, phase: "error", error: event.error };
    case "STOP":
      return {
        ...initialDocumentSyncMachineState,
        lastSyncedAt: state.lastSyncedAt,
      };
  }
}

export function calculateRetryDelay(
  attempt: number,
  random: () => number = Math.random,
  baseDelayMs = 1_000,
  maxDelayMs = 60_000,
): number {
  const exponentialDelay = Math.min(
    maxDelayMs,
    baseDelayMs * 2 ** Math.max(0, attempt - 1),
  );
  const jitterMultiplier = 0.8 + random() * 0.4;
  return Math.round(exponentialDelay * jitterMultiplier);
}

function queueChangedPhase(
  phase: DocumentSyncPhase,
  pendingOperations: number,
): DocumentSyncPhase {
  if (["offline", "waiting-retry", "conflict", "error"].includes(phase)) {
    return phase;
  }
  if (phase === "bootstrapping") {
    return "bootstrapping";
  }
  if (phase === "syncing") {
    return "syncing";
  }
  return pendingOperations > 0 ? "queued" : "synced";
}
