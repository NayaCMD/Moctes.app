import type { MoctesDocument } from "../types/document.types";
import { useDocumentStore } from "../stores/useDocumentStore";
import { useDocumentSyncStore } from "../stores/useDocumentSyncStore";
import { useEditorStore } from "../stores/useEditorStore";
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  type ApiResponse,
} from "./apiClient";
import {
  documentSyncQueue,
  type DocumentSyncQueueOperation,
} from "./sync/documentSyncQueue";
import {
  calculateRetryDelay,
  type DocumentSyncEvent,
} from "./sync/documentSyncMachine";
import { migrateDocumentAssetReferences } from "../utils/assetReferenceMigration.utils";
import { applyHistoryPatches, type HistoryPatch } from "../utils/history.utils";
import { isRealtimeManaged } from "./collaborationRuntime";

const AUTOSAVE_DELAY_MS = 800;
const CACHE_SCOPE_KEY = "moctes-cache-scope";
const SYNC_JOURNAL_KEY = "moctes-document-sync-journal-v1";
const BOOTSTRAP_MARKER_PREFIX = "moctes-document-bootstrap-v1:";

interface DocumentSyncJournalEntry {
  revision: string;
  scope: string;
  workspaceId: string;
  documentId: string;
  kind: "upsert" | "delete";
}

export interface PersistedDocumentRecord {
  id: string;
  version: number;
  collaborationSequence: number;
  document: MoctesDocument;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CreateDocumentPayload {
  workspaceId: string;
  id: string;
  title: string;
  type: MoctesDocument["type"];
  schemaVersion: number;
  document: MoctesDocument;
}

export interface UpdateDocumentPayload {
  expectedVersion: number;
  expectedCollaborationSequence: number;
  document: MoctesDocument;
}

export interface DocumentConflictDetails {
  documentId: string;
  operationKind: "upsert" | "delete";
  localDocument: MoctesDocument | null;
  remoteRecord: PersistedDocumentRecord | null;
}

export type DocumentConflictResolution = "local" | "remote";

type FailedApiResponse = Extract<ApiResponse<unknown>, { ok: false }>;

const versions = new Map<string, number>();
const collaborationSequences = new Map<string, number>();
const fingerprints = new Map<string, string>();
const conflictOperations = new Map<string, DocumentSyncQueueOperation>();
let started = false;
let activeScope: string | null = null;
let activeWorkspaceId: string | null = null;
let persistenceGeneration = 0;
let applyingRemoteState = false;
let needsRemoteBootstrap = true;
let syncBlocked = false;
let bootstrapAttempt = 0;
let workTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;
let processingPromise: Promise<void> | null = null;
let queueMutationChain = Promise.resolve();

export async function startDocumentPersistence(
  workspaceId: string,
  userId: string,
): Promise<void> {
  const scope = `${userId}:${workspaceId}`;
  if (started) {
    if (activeScope === scope) {
      return processingPromise ?? Promise.resolve();
    }
    stopDocumentPersistence();
  }

  const generation = ++persistenceGeneration;
  started = true;
  activeScope = scope;
  activeWorkspaceId = workspaceId;
  needsRemoteBootstrap = true;
  syncBlocked = false;
  bootstrapAttempt = 0;
  prepareDocumentScope(scope);
  dispatchSync({ type: "START" });
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  try {
    await recoverDocumentJournal(scope, workspaceId);
    await bootstrapRemoteState(generation, scope, workspaceId);
  } catch (error) {
    handleQueueFailure(error, generation);
  }
}

export function stopDocumentPersistence(): void {
  persistenceGeneration += 1;
  clearWorkTimer();
  unsubscribe?.();
  unsubscribe = null;
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
  versions.clear();
  collaborationSequences.clear();
  fingerprints.clear();
  conflictOperations.clear();
  processingPromise = null;
  started = false;
  activeScope = null;
  activeWorkspaceId = null;
  needsRemoteBootstrap = true;
  syncBlocked = false;
  bootstrapAttempt = 0;
  dispatchSync({ type: "STOP" });
}

export async function flushDocumentPersistence(): Promise<void> {
  await queueMutationChain;
  const generation = persistenceGeneration;
  const scope = activeScope;
  const workspaceId = activeWorkspaceId;
  if (!started || !scope || !workspaceId || syncBlocked) {
    return;
  }
  clearWorkTimer();
  if (needsRemoteBootstrap) {
    await bootstrapRemoteState(generation, scope, workspaceId);
    return;
  }
  await processQueue(generation, scope);
}

export async function retryDocumentPersistence(): Promise<void> {
  const generation = persistenceGeneration;
  const scope = activeScope;
  if (!started || !scope) {
    return;
  }
  try {
    syncBlocked = false;
    bootstrapAttempt = 0;
    clearWorkTimer();
    await documentSyncQueue.makeScopeDue(scope);
    const pendingOperations = (await documentSyncQueue.list(scope)).length;
    dispatchSync({ type: "RETRY_REQUESTED", pendingOperations });
    await flushDocumentPersistence();
  } catch (error) {
    handleQueueFailure(error, generation);
  }
}

export async function loadDocumentConflictDetails(
  documentId: string,
  operationId?: string,
): Promise<ApiResponse<DocumentConflictDetails>> {
  const scope = activeScope;
  if (!started || !scope) {
    return {
      ok: false,
      status: 409,
      error: "Synchronization is not active.",
    };
  }
  try {
    const operation = findConflictOperation(
      await documentSyncQueue.list(scope),
      documentId,
      operationId,
    );
    if (!operation) {
      return {
        ok: false,
        status: 404,
        error: "The conflicting local operation was not found.",
      };
    }
    const remote = await apiGet<PersistedDocumentRecord>(
      `/documents/${encodeURIComponent(documentId)}`,
    );
    if (!remote.ok && remote.status !== 404) {
      return remote;
    }
    return {
      ok: true,
      data: {
        documentId,
        operationKind: operation.kind,
        localDocument: operation.document ?? null,
        remoteRecord: remote.ok ? remote.data : null,
      },
    };
  } catch (error) {
    return queueErrorResponse(error);
  }
}

export async function resolveDocumentConflict(
  documentId: string,
  resolution: DocumentConflictResolution,
  operationId?: string,
): Promise<ApiResponse<null>> {
  const generation = persistenceGeneration;
  const scope = activeScope;
  if (!started || !scope) {
    return {
      ok: false,
      status: 409,
      error: "Synchronization is not active.",
    };
  }
  try {
    const operation = findConflictOperation(
      await documentSyncQueue.list(scope),
      documentId,
      operationId,
    );
    if (!operation) {
      return {
        ok: false,
        status: 404,
        error: "The conflicting local operation was not found.",
      };
    }
    const remote = await apiGet<PersistedDocumentRecord>(
      `/documents/${encodeURIComponent(documentId)}`,
    );
    if (!remote.ok && remote.status !== 404) {
      return remote;
    }

    if (resolution === "remote") {
      await documentSyncQueue.removeIfRevision(
        operation.id,
        operation.revision,
      );
      if (remote.ok) {
        const migratedRemote = migratePersistedRecord(remote.data);
        rememberPersistedDocument(migratedRemote);
        applySingleDocumentFromServer(documentId, migratedRemote.document);
        if (
          migratedRemote.document !== remote.data.document &&
          activeWorkspaceId
        ) {
          await documentSyncQueue.enqueueUpsert(
            scope,
            activeWorkspaceId,
            migratedRemote.document,
          );
        }
      } else {
        versions.delete(documentId);
        collaborationSequences.delete(documentId);
        fingerprints.delete(documentId);
        applySingleDocumentFromServer(documentId, null);
      }
    } else {
      if (remote.ok) {
        rememberPersistedDocument(remote.data);
      } else {
        versions.delete(documentId);
        collaborationSequences.delete(documentId);
        fingerprints.delete(documentId);
      }
      const operationStillQueued = (await documentSyncQueue.list(scope)).some(
        (item) => item.id === operation.id,
      );
      if (!operationStillQueued && operation.document && activeWorkspaceId) {
        await documentSyncQueue.enqueueUpsert(
          scope,
          activeWorkspaceId,
          operation.document,
        );
      }
      await documentSyncQueue.makeScopeDue(scope);
    }

    syncBlocked = false;
    conflictOperations.delete(documentId);
    const pendingOperations = (await documentSyncQueue.list(scope)).length;
    dispatchSync({
      type: "CONFLICT_RESOLVED",
      documentId,
      pendingOperations,
    });
    if (pendingOperations > 0 && isCurrentRun(generation, scope)) {
      await processQueue(generation, scope);
    }
    return { ok: true, data: null };
  } catch (error) {
    handleQueueFailure(error, generation);
    return queueErrorResponse(error);
  }
}

export async function restoreDocumentRevision(
  documentId: string,
  revisionVersion: number,
  expectedVersion: number,
): Promise<ApiResponse<PersistedDocumentRecord>> {
  const generation = persistenceGeneration;
  const scope = activeScope;
  if (!started || !scope) {
    return {
      ok: false,
      status: 409,
      error: "Synchronization is not active.",
    };
  }
  const response = await apiPost<
    {
      expectedVersion: number;
      expectedCollaborationSequence: number;
    },
    PersistedDocumentRecord
  >(
    `/documents/${encodeURIComponent(documentId)}/revisions/${revisionVersion}/restore`,
    {
      expectedVersion,
      expectedCollaborationSequence:
        collaborationSequences.get(documentId) ?? 0,
    },
  );
  if (!response.ok) {
    return response;
  }
  try {
    const operation = (await documentSyncQueue.list(scope)).find(
      (item) => item.documentId === documentId,
    );
    if (operation) {
      await documentSyncQueue.removeIfRevision(
        operation.id,
        operation.revision,
      );
    }
    const migratedRecord = migratePersistedRecord(response.data);
    rememberPersistedDocument(migratedRecord);
    applySingleDocumentFromServer(documentId, migratedRecord.document);
    if (
      migratedRecord.document !== response.data.document &&
      activeWorkspaceId
    ) {
      await documentSyncQueue.enqueueUpsert(
        scope,
        activeWorkspaceId,
        migratedRecord.document,
      );
    }
    syncBlocked = false;
    const pendingOperations = (await documentSyncQueue.list(scope)).length;
    dispatchSync({
      type: "CONFLICT_RESOLVED",
      documentId,
      pendingOperations,
    });
    if (pendingOperations > 0 && isCurrentRun(generation, scope)) {
      await processQueue(generation, scope);
    }
    return { ...response, data: migratedRecord };
  } catch (error) {
    handleQueueFailure(error, generation);
    return queueErrorResponse(error);
  }
}

export function loadDeletedDocuments(
  workspaceId: string,
): Promise<ApiResponse<PersistedDocumentRecord[]>> {
  return apiGet<PersistedDocumentRecord[]>(
    `/documents/trash?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
}

export async function restoreDeletedDocument(
  workspaceId: string,
  documentId: string,
): Promise<ApiResponse<PersistedDocumentRecord>> {
  const response = await apiPost<never, PersistedDocumentRecord>(
    `/documents/${encodeURIComponent(documentId)}/restore-deleted?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
  if (!response.ok) return response;
  const migrated = migratePersistedRecord(response.data);
  rememberPersistedDocument(migrated);
  applySingleDocumentFromServer(documentId, migrated.document);
  return { ...response, data: migrated };
}

export function toCreateDocumentPayload(
  document: MoctesDocument,
  workspaceId: string,
): CreateDocumentPayload {
  const canonicalDocument = migrateDocumentAssetReferences(document);
  return {
    workspaceId,
    id: canonicalDocument.id,
    title: canonicalDocument.title,
    type: canonicalDocument.type,
    schemaVersion: canonicalDocument.schemaVersion ?? 1,
    document: canonicalDocument,
  };
}

async function bootstrapRemoteState(
  generation: number,
  scope: string,
  workspaceId: string,
): Promise<void> {
  if (!isCurrentRun(generation, scope)) {
    return;
  }
  needsRemoteBootstrap = true;
  const queuedBeforeRequest = await documentSyncQueue.list(scope);
  dispatchSync({
    type: "QUEUE_CHANGED",
    pendingOperations: queuedBeforeRequest.length,
  });

  const response = await apiGet<PersistedDocumentRecord[]>(
    `/documents?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
  if (!isCurrentRun(generation, scope)) {
    return;
  }
  if (!response.ok) {
    subscribeToLocalChanges(generation, scope, workspaceId);
    await handleBootstrapFailure(response, generation, scope, workspaceId);
    return;
  }
  if (!response.data.every(isPersistedDocumentRecord)) {
    syncBlocked = true;
    subscribeToLocalChanges(generation, scope, workspaceId);
    dispatchSync({
      type: "FATAL_ERROR",
      error: "Server returned invalid documents.",
    });
    return;
  }

  needsRemoteBootstrap = false;
  bootstrapAttempt = 0;
  versions.clear();
  collaborationSequences.clear();
  fingerprints.clear();
  const migratedRecords = response.data.map(migratePersistedRecord);
  migratedRecords.forEach(rememberPersistedDocument);

  let queuedOperations = await documentSyncQueue.list(scope);
  if (response.data.length === 0 && queuedOperations.length === 0) {
    if (!hasCompletedBootstrap(scope)) {
      for (const document of useDocumentStore.getState().documents) {
        await documentSyncQueue.enqueueUpsert(scope, workspaceId, document);
      }
      queuedOperations = await documentSyncQueue.list(scope);
    } else {
      syncBlocked = true;
      subscribeToLocalChanges(generation, scope, workspaceId);
      dispatchSync({
        type: "FATAL_ERROR",
        error:
          "The workspace unexpectedly has no documents. Local data was preserved and was not uploaded automatically.",
      });
      return;
    }
  }

  const queuedDocumentIds = new Set(
    queuedOperations.map((operation) => operation.documentId),
  );
  for (let index = 0; index < response.data.length; index += 1) {
    const original = response.data[index];
    const migrated = migratedRecords[index];
    if (
      original.document !== migrated.document &&
      !queuedDocumentIds.has(migrated.id)
    ) {
      await documentSyncQueue.enqueueUpsert(
        scope,
        workspaceId,
        migrated.document,
      );
    }
  }
  queuedOperations = await documentSyncQueue.list(scope);

  const desiredDocuments = overlayQueuedOperations(
    migratedRecords.map((record) => record.document),
    queuedOperations,
  );
  if (desiredDocuments.length > 0) {
    applyDocumentsFromSync(desiredDocuments);
  }
  subscribeToLocalChanges(generation, scope, workspaceId);
  markBootstrapCompleted(scope);
  dispatchSync({
    type: "BOOTSTRAP_COMPLETE",
    pendingOperations: queuedOperations.length,
  });

  if (queuedOperations.length > 0) {
    await processQueue(generation, scope);
  }
}

async function handleBootstrapFailure(
  response: FailedApiResponse,
  generation: number,
  scope: string,
  workspaceId: string,
): Promise<void> {
  const pendingOperations = (await documentSyncQueue.list(scope)).length;
  if (!isTransientFailure(response)) {
    syncBlocked = true;
    dispatchSync({ type: "FATAL_ERROR", error: response.error });
    return;
  }
  bootstrapAttempt += 1;
  if (!isBrowserOnline()) {
    dispatchSync({
      type: "NETWORK_OFFLINE",
      pendingOperations,
      error: response.error,
    });
    return;
  }
  const delay = response.retryAfterMs ?? calculateRetryDelay(bootstrapAttempt);
  const nextRetryAt = new Date(Date.now() + delay).toISOString();
  dispatchSync({
    type: "RETRY_SCHEDULED",
    pendingOperations,
    attempt: bootstrapAttempt,
    nextRetryAt,
    error: response.error,
  });
  scheduleWork(() => {
    return bootstrapRemoteState(generation, scope, workspaceId);
  }, delay);
}

function subscribeToLocalChanges(
  generation: number,
  scope: string,
  workspaceId: string,
): void {
  unsubscribe?.();
  unsubscribe = useDocumentStore.subscribe((state, previous) => {
    if (
      applyingRemoteState ||
      state.documents === previous.documents ||
      !isCurrentRun(generation, scope)
    ) {
      return;
    }
    const journalRevisions = recordDocumentJournal(
      previous.documents,
      state.documents,
      scope,
      workspaceId,
    );
    queueMutationChain = queueMutationChain
      .catch(() => undefined)
      .then(() =>
        enqueueDocumentChanges(
          previous.documents,
          state.documents,
          generation,
          scope,
          workspaceId,
          journalRevisions,
        ),
      )
      .catch((error: unknown) => handleQueueFailure(error, generation));
  });
}

async function enqueueDocumentChanges(
  previousDocuments: MoctesDocument[],
  currentDocuments: MoctesDocument[],
  generation: number,
  scope: string,
  workspaceId: string,
  journalRevisions = new Map<string, string>(),
): Promise<void> {
  const previousById = new Map(
    previousDocuments.map((document) => [document.id, document]),
  );
  const currentIds = new Set(currentDocuments.map((document) => document.id));

  for (const document of currentDocuments) {
    if (
      !isRealtimeManaged(document.id) &&
      previousById.get(document.id) !== document &&
      fingerprints.get(document.id) !== fingerprintDocument(document)
    ) {
      await documentSyncQueue.enqueueUpsert(scope, workspaceId, document);
      clearJournalEntryIfRevision(
        scope,
        document.id,
        journalRevisions.get(document.id),
      );
    }
  }
  for (const document of previousDocuments) {
    if (!currentIds.has(document.id)) {
      await documentSyncQueue.enqueueDelete(scope, workspaceId, document.id);
      clearJournalEntryIfRevision(
        scope,
        document.id,
        journalRevisions.get(document.id),
      );
    }
  }
  if (!isCurrentRun(generation, scope)) {
    return;
  }
  const pendingOperations = (await documentSyncQueue.list(scope)).length;
  dispatchSync({ type: "QUEUE_CHANGED", pendingOperations });
  if (!syncBlocked) {
    scheduleWork(() => {
      return flushDocumentPersistence();
    }, AUTOSAVE_DELAY_MS);
  }
}

export function applyRealtimeDocumentPatches(
  documentId: string,
  patches: HistoryPatch[],
): void {
  applyingRemoteState = true;
  try {
    const documentPatches = patches.map((patch) => ({
      ...patch,
      path: [{ id: documentId }, ...patch.path],
    })) as HistoryPatch[];
    const current = useDocumentStore.getState().documents;
    useDocumentStore.setState({
      documents: applyHistoryPatches(current, documentPatches),
    });
  } finally {
    applyingRemoteState = false;
  }
}

export function applyRealtimeDocumentSnapshot(
  record: PersistedDocumentRecord,
): void {
  rememberPersistedDocument(record);
  applySingleDocumentFromServer(record.id, record.document);
}

export async function queueCurrentDocumentForPersistence(
  documentId: string,
): Promise<void> {
  const scope = activeScope;
  const workspaceId = activeWorkspaceId;
  const document = useDocumentStore
    .getState()
    .documents.find((item) => item.id === documentId);
  if (!scope || !workspaceId || !document) return;
  await documentSyncQueue.enqueueUpsert(scope, workspaceId, document);
  const pendingOperations = (await documentSyncQueue.list(scope)).length;
  dispatchSync({ type: "QUEUE_CHANGED", pendingOperations });
  scheduleWork(() => flushDocumentPersistence(), 0);
}

async function processQueue(generation: number, scope: string): Promise<void> {
  if (processingPromise) {
    return processingPromise;
  }
  const currentPromise = drainQueue(generation, scope).finally(() => {
    if (processingPromise === currentPromise) {
      processingPromise = null;
    }
  });
  processingPromise = currentPromise;
  return currentPromise;
}

async function drainQueue(generation: number, scope: string): Promise<void> {
  while (
    isCurrentRun(generation, scope) &&
    !needsRemoteBootstrap &&
    !syncBlocked
  ) {
    const operations = await documentSyncQueue.list(scope);
    if (!isCurrentRun(generation, scope)) {
      return;
    }
    if (operations.length === 0) {
      dispatchSync({
        type: "SYNC_SUCCEEDED",
        pendingOperations: 0,
        at: new Date().toISOString(),
      });
      return;
    }
    if (!isBrowserOnline()) {
      dispatchSync({
        type: "NETWORK_OFFLINE",
        pendingOperations: operations.length,
        error: "No network connection.",
      });
      return;
    }

    const operation = operations[0];
    const waitMs = Math.max(0, operation.nextAttemptAt - Date.now());
    if (waitMs > 0) {
      dispatchSync({
        type: "RETRY_SCHEDULED",
        pendingOperations: operations.length,
        attempt: operation.attempts,
        nextRetryAt: new Date(operation.nextAttemptAt).toISOString(),
        error: operation.lastError ?? "Waiting to retry synchronization.",
      });
      scheduleWork(() => {
        return flushDocumentPersistence();
      }, waitMs);
      return;
    }

    dispatchSync({
      type: "SYNC_STARTED",
      pendingOperations: operations.length,
    });
    const failure = await executeOperation(operation, generation, scope);
    if (!isCurrentRun(generation, scope)) {
      return;
    }
    if (!failure) {
      const pendingOperations = (await documentSyncQueue.list(scope)).length;
      dispatchSync({
        type: "SYNC_SUCCEEDED",
        pendingOperations,
        at: new Date().toISOString(),
      });
      continue;
    }
    await handleOperationFailure(
      operation,
      failure,
      operations.length,
      generation,
      scope,
    );
    return;
  }
}

async function executeOperation(
  operation: DocumentSyncQueueOperation,
  generation: number,
  scope: string,
): Promise<FailedApiResponse | null> {
  if (operation.kind === "delete") {
    if (!versions.has(operation.documentId)) {
      await documentSyncQueue.removeIfRevision(
        operation.id,
        operation.revision,
      );
      fingerprints.delete(operation.documentId);
      return null;
    }
    const response = await apiDelete<null>(
      `/documents/${encodeURIComponent(operation.documentId)}`,
    );
    if (!isCurrentRun(generation, scope)) {
      return null;
    }
    if (response.ok || response.status === 404) {
      await documentSyncQueue.removeIfRevision(
        operation.id,
        operation.revision,
      );
      versions.delete(operation.documentId);
      collaborationSequences.delete(operation.documentId);
      fingerprints.delete(operation.documentId);
      return null;
    }
    return response;
  }

  if (!operation.document) {
    return { ok: false, status: 422, error: "Queued document is missing." };
  }
  const canonicalDocument = migrateDocumentAssetReferences(operation.document);
  const version = versions.get(operation.documentId);
  const response = version
    ? await apiPut<UpdateDocumentPayload, PersistedDocumentRecord>(
        `/documents/${encodeURIComponent(operation.documentId)}`,
        {
          expectedVersion: version,
          expectedCollaborationSequence:
            collaborationSequences.get(operation.documentId) ?? 0,
          document: canonicalDocument,
        },
      )
    : await apiPost<CreateDocumentPayload, PersistedDocumentRecord>(
        "/documents",
        toCreateDocumentPayload(canonicalDocument, operation.workspaceId),
      );
  if (!isCurrentRun(generation, scope)) {
    return null;
  }
  if (response.ok) {
    rememberPersistedDocument(response.data);
    await documentSyncQueue.removeIfRevision(operation.id, operation.revision);
    return null;
  }
  if (response.status === 409) {
    return reconcileAmbiguousWrite(operation, response, generation, scope);
  }
  return response;
}

async function reconcileAmbiguousWrite(
  operation: DocumentSyncQueueOperation,
  conflict: FailedApiResponse,
  generation: number,
  scope: string,
): Promise<FailedApiResponse | null> {
  const remote = await apiGet<PersistedDocumentRecord>(
    `/documents/${encodeURIComponent(operation.documentId)}`,
  );
  if (!isCurrentRun(generation, scope)) {
    return null;
  }
  if (
    remote.ok &&
    operation.document &&
    fingerprintDocument(
      migrateDocumentAssetReferences(remote.data.document),
    ) ===
      fingerprintDocument(migrateDocumentAssetReferences(operation.document))
  ) {
    rememberPersistedDocument(migratePersistedRecord(remote.data));
    await documentSyncQueue.removeIfRevision(operation.id, operation.revision);
    return null;
  }
  if (!remote.ok && isTransientFailure(remote)) {
    return remote;
  }
  return conflict;
}

async function handleOperationFailure(
  operation: DocumentSyncQueueOperation,
  response: FailedApiResponse,
  pendingOperations: number,
  generation: number,
  scope: string,
): Promise<void> {
  if (response.status === 409 || response.status === 404) {
    syncBlocked = true;
    conflictOperations.set(operation.documentId, structuredClone(operation));
    dispatchSync({
      type: "CONFLICT",
      documentId: operation.documentId,
      operationId: operation.id,
      error: response.error,
    });
    return;
  }
  if (!isTransientFailure(response)) {
    syncBlocked = true;
    dispatchSync({ type: "FATAL_ERROR", error: response.error });
    return;
  }

  const attempt = operation.attempts + 1;
  const delay = response.retryAfterMs ?? calculateRetryDelay(attempt);
  const nextAttemptAt = Date.now() + delay;
  const updated = await documentSyncQueue.markRetryIfRevision(
    operation.id,
    operation.revision,
    attempt,
    nextAttemptAt,
    response.error,
  );
  if (!updated && isCurrentRun(generation, scope)) {
    scheduleWork(() => {
      return flushDocumentPersistence();
    }, 0);
    return;
  }
  if (!isBrowserOnline()) {
    dispatchSync({
      type: "NETWORK_OFFLINE",
      pendingOperations,
      error: response.error,
    });
    return;
  }
  dispatchSync({
    type: "RETRY_SCHEDULED",
    pendingOperations,
    attempt,
    nextRetryAt: new Date(nextAttemptAt).toISOString(),
    error: response.error,
  });
  scheduleWork(() => {
    return flushDocumentPersistence();
  }, delay);
}

async function handleOnline(): Promise<void> {
  const generation = persistenceGeneration;
  const scope = activeScope;
  if (!started || !scope || syncBlocked) {
    return;
  }
  clearWorkTimer();
  try {
    await documentSyncQueue.makeScopeDue(scope);
    const pendingOperations = (await documentSyncQueue.list(scope)).length;
    dispatchSync({ type: "NETWORK_ONLINE", pendingOperations });
    await flushDocumentPersistence();
  } catch (error) {
    handleQueueFailure(error, generation);
  }
}

function handleOffline(): void {
  const generation = persistenceGeneration;
  const scope = activeScope;
  if (!started || !scope || !isCurrentRun(generation, scope)) {
    return;
  }
  clearWorkTimer();
  void documentSyncQueue
    .list(scope)
    .then((operations) => {
      if (isCurrentRun(generation, scope)) {
        dispatchSync({
          type: "NETWORK_OFFLINE",
          pendingOperations: operations.length,
          error: "No network connection.",
        });
      }
    })
    .catch((error: unknown) => handleQueueFailure(error, generation));
}

function overlayQueuedOperations(
  remoteDocuments: MoctesDocument[],
  operations: DocumentSyncQueueOperation[],
): MoctesDocument[] {
  const desired = new Map(
    remoteDocuments.map((document) => [document.id, document]),
  );
  for (const operation of operations) {
    if (operation.kind === "delete") {
      desired.delete(operation.documentId);
    } else if (operation.document) {
      desired.set(
        operation.documentId,
        migrateDocumentAssetReferences(operation.document),
      );
    }
  }
  return [...desired.values()];
}

function applyDocumentsFromSync(documents: MoctesDocument[]): void {
  applyingRemoteState = true;
  try {
    useDocumentStore.getState().applyDocumentsSnapshot(documents);
    useEditorStore.setState({ undoStack: [], redoStack: [] });
  } finally {
    applyingRemoteState = false;
  }
}

function applySingleDocumentFromServer(
  documentId: string,
  remoteDocument: MoctesDocument | null,
): void {
  const currentDocuments = useDocumentStore.getState().documents;
  const nextDocuments = remoteDocument
    ? currentDocuments.some((document) => document.id === documentId)
      ? currentDocuments.map((document) =>
          document.id === documentId ? remoteDocument : document,
        )
      : [...currentDocuments, remoteDocument]
    : currentDocuments.filter((document) => document.id !== documentId);
  if (nextDocuments.length > 0) {
    applyDocumentsFromSync(nextDocuments);
  }
}

export function applyRealtimeDocumentDeletion(documentId: string): void {
  versions.delete(documentId);
  collaborationSequences.delete(documentId);
  fingerprints.delete(documentId);
  applySingleDocumentFromServer(documentId, null);
}

function recordDocumentJournal(
  previousDocuments: MoctesDocument[],
  currentDocuments: MoctesDocument[],
  scope: string,
  workspaceId: string,
): Map<string, string> {
  const entries = readDocumentJournal();
  const revisions = new Map<string, string>();
  const previousById = new Map(
    previousDocuments.map((document) => [document.id, document]),
  );
  const currentIds = new Set(currentDocuments.map((document) => document.id));

  for (const document of currentDocuments) {
    if (
      !isRealtimeManaged(document.id) &&
      previousById.get(document.id) !== document
    ) {
      const revision = createJournalRevision();
      entries.set(journalEntryKey(scope, document.id), {
        revision,
        scope,
        workspaceId,
        documentId: document.id,
        kind: "upsert",
      });
      revisions.set(document.id, revision);
    }
  }
  for (const document of previousDocuments) {
    if (!currentIds.has(document.id)) {
      const revision = createJournalRevision();
      entries.set(journalEntryKey(scope, document.id), {
        revision,
        scope,
        workspaceId,
        documentId: document.id,
        kind: "delete",
      });
      revisions.set(document.id, revision);
    }
  }
  writeDocumentJournal(entries);
  return revisions;
}

async function recoverDocumentJournal(
  scope: string,
  workspaceId: string,
): Promise<void> {
  const entries = readDocumentJournal();
  const documents = new Map(
    useDocumentStore
      .getState()
      .documents.map((document) => [document.id, document]),
  );
  for (const entry of entries.values()) {
    if (entry.scope !== scope || entry.workspaceId !== workspaceId) continue;
    if (entry.kind === "delete") {
      await documentSyncQueue.enqueueDelete(
        scope,
        workspaceId,
        entry.documentId,
      );
    } else {
      const document = documents.get(entry.documentId);
      if (document) {
        await documentSyncQueue.enqueueUpsert(scope, workspaceId, document);
      }
    }
    clearJournalEntryIfRevision(scope, entry.documentId, entry.revision);
  }
}

function clearJournalEntryIfRevision(
  scope: string,
  documentId: string,
  revision: string | undefined,
): void {
  if (!revision) return;
  const entries = readDocumentJournal();
  const key = journalEntryKey(scope, documentId);
  if (entries.get(key)?.revision !== revision) return;
  entries.delete(key);
  writeDocumentJournal(entries);
}

function readDocumentJournal(): Map<string, DocumentSyncJournalEntry> {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(SYNC_JOURNAL_KEY) ?? "[]",
    ) as unknown;
    if (!Array.isArray(parsed)) return new Map();
    return new Map(
      parsed
        .filter(isDocumentSyncJournalEntry)
        .map((entry) => [
          journalEntryKey(entry.scope, entry.documentId),
          entry,
        ]),
    );
  } catch {
    return new Map();
  }
}

function writeDocumentJournal(
  entries: Map<string, DocumentSyncJournalEntry>,
): void {
  try {
    if (entries.size === 0) {
      window.localStorage.removeItem(SYNC_JOURNAL_KEY);
      return;
    }
    window.localStorage.setItem(
      SYNC_JOURNAL_KEY,
      JSON.stringify([...entries.values()]),
    );
  } catch (error) {
    dispatchSync({
      type: "FATAL_ERROR",
      error:
        error instanceof Error
          ? `Could not persist the local sync journal: ${error.message}`
          : "Could not persist the local sync journal.",
    });
  }
}

function isDocumentSyncJournalEntry(
  value: unknown,
): value is DocumentSyncJournalEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<DocumentSyncJournalEntry>;
  return (
    typeof entry.revision === "string" &&
    typeof entry.scope === "string" &&
    typeof entry.workspaceId === "string" &&
    typeof entry.documentId === "string" &&
    (entry.kind === "upsert" || entry.kind === "delete")
  );
}

function journalEntryKey(scope: string, documentId: string): string {
  return `${scope}\u0000${documentId}`;
}

function createJournalRevision(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function hasCompletedBootstrap(scope: string): boolean {
  return (
    window.localStorage.getItem(`${BOOTSTRAP_MARKER_PREFIX}${scope}`) === "1"
  );
}

function markBootstrapCompleted(scope: string): void {
  window.localStorage.setItem(`${BOOTSTRAP_MARKER_PREFIX}${scope}`, "1");
}

function rememberPersistedDocument(record: PersistedDocumentRecord): void {
  versions.set(record.id, record.version);
  collaborationSequences.set(record.id, record.collaborationSequence);
  fingerprints.set(record.id, fingerprintDocument(record.document));
}

export function rememberRealtimeCollaborationSequence(
  documentId: string,
  sequence: number,
): void {
  collaborationSequences.set(
    documentId,
    Math.max(collaborationSequences.get(documentId) ?? 0, sequence),
  );
}

export function rememberRealtimeDocumentVersion(
  documentId: string,
  version: number,
): void {
  versions.set(documentId, Math.max(versions.get(documentId) ?? 0, version));
}

function migratePersistedRecord(
  record: PersistedDocumentRecord,
): PersistedDocumentRecord {
  const document = migrateDocumentAssetReferences(record.document);
  return document === record.document ? record : { ...record, document };
}

function dispatchSync(event: DocumentSyncEvent): void {
  useDocumentSyncStore.getState().dispatch(event);
}

function scheduleWork(action: () => void | Promise<void>, delay: number): void {
  clearWorkTimer();
  workTimer = setTimeout(() => {
    workTimer = null;
    void Promise.resolve(action()).catch((error: unknown) =>
      handleQueueFailure(error, persistenceGeneration),
    );
  }, delay);
}

function clearWorkTimer(): void {
  if (workTimer) {
    clearTimeout(workTimer);
    workTimer = null;
  }
}

function handleQueueFailure(error: unknown, generation: number): void {
  if (!started || generation !== persistenceGeneration) {
    return;
  }
  syncBlocked = true;
  dispatchSync({
    type: "FATAL_ERROR",
    error:
      error instanceof Error
        ? error.message
        : "The durable synchronization queue failed.",
  });
}

function queueErrorResponse(error: unknown): FailedApiResponse {
  return {
    ok: false,
    status: 0,
    error:
      error instanceof Error
        ? error.message
        : "The durable synchronization queue failed.",
  };
}

function fingerprintDocument(document: MoctesDocument): string {
  return JSON.stringify(document);
}

function isPersistedDocumentRecord(
  value: PersistedDocumentRecord,
): value is PersistedDocumentRecord {
  return (
    typeof value.id === "string" &&
    Number.isInteger(value.version) &&
    value.version > 0 &&
    Number.isInteger(value.collaborationSequence) &&
    value.collaborationSequence >= 0 &&
    typeof value.document === "object" &&
    value.document !== null &&
    value.document.id === value.id &&
    Array.isArray(value.document.pages)
  );
}

function isTransientFailure(response: FailedApiResponse): boolean {
  return (
    response.status === 0 ||
    response.status === 408 ||
    response.status === 425 ||
    response.status === 429 ||
    response.status >= 500
  );
}

function isBrowserOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function prepareDocumentScope(scope: string): void {
  const storedScope = window.localStorage.getItem(CACHE_SCOPE_KEY);
  if (storedScope !== scope) {
    applyingRemoteState = true;
    try {
      useDocumentStore.getState().restoreDemoDocuments(scope);
      useEditorStore.setState({ undoStack: [], redoStack: [] });
      versions.clear();
      collaborationSequences.clear();
      fingerprints.clear();
    } finally {
      applyingRemoteState = false;
    }
  }
  window.localStorage.setItem(CACHE_SCOPE_KEY, scope);
}

function isCurrentRun(generation: number, scope: string): boolean {
  return (
    started && generation === persistenceGeneration && activeScope === scope
  );
}

function findConflictOperation(
  queued: DocumentSyncQueueOperation[],
  documentId: string,
  operationId?: string,
): DocumentSyncQueueOperation | undefined {
  return (
    (operationId
      ? queued.find((item) => item.id === operationId)
      : undefined) ??
    queued.find((item) => item.documentId === documentId) ??
    conflictOperations.get(documentId)
  );
}
