import type { MoctesDocument } from "../../types/document.types";

const DB_NAME = "moctes-document-sync";
const DB_VERSION = 1;
const STORE_NAME = "operations";
const SCOPE_INDEX = "scope";
const CLIENT_ID_KEY = "moctes-document-sync-client";

export type DocumentSyncOperationKind = "upsert" | "delete";

export interface DocumentSyncQueueOperation {
  id: string;
  revision: string;
  scope: string;
  workspaceId: string;
  documentId: string;
  kind: DocumentSyncOperationKind;
  document?: MoctesDocument;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSyncQueue {
  enqueueUpsert: (
    scope: string,
    workspaceId: string,
    document: MoctesDocument,
  ) => Promise<DocumentSyncQueueOperation>;
  enqueueDelete: (
    scope: string,
    workspaceId: string,
    documentId: string,
  ) => Promise<DocumentSyncQueueOperation>;
  list: (scope: string) => Promise<DocumentSyncQueueOperation[]>;
  removeIfRevision: (id: string, revision: string) => Promise<boolean>;
  markRetryIfRevision: (
    id: string,
    revision: string,
    attempts: number,
    nextAttemptAt: number,
    lastError: string,
  ) => Promise<boolean>;
  makeScopeDue: (scope: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

const memoryOperations = new Map<string, DocumentSyncQueueOperation>();

export const documentSyncQueue: DocumentSyncQueue = {
  enqueueUpsert: (scope, workspaceId, document) =>
    putDesiredOperation(scope, workspaceId, document.id, "upsert", document),

  enqueueDelete: (scope, workspaceId, documentId) =>
    putDesiredOperation(scope, workspaceId, documentId, "delete"),

  async list(scope) {
    if (!hasIndexedDb()) {
      return [...memoryOperations.values()]
        .filter((operation) => operation.scope === scope)
        .map(cloneOperation)
        .sort(compareOperations);
    }
    return runTransaction<DocumentSyncQueueOperation[]>(
      "readonly",
      [],
      (store, resolve) => {
        const request = store
          .index(SCOPE_INDEX)
          .getAll(IDBKeyRange.only(scope));
        request.onsuccess = () =>
          resolve(
            (request.result as DocumentSyncQueueOperation[]).sort(
              compareOperations,
            ),
          );
      },
    );
  },

  async removeIfRevision(id, revision) {
    if (!hasIndexedDb()) {
      const current = memoryOperations.get(id);
      if (current?.revision !== revision) {
        return false;
      }
      memoryOperations.delete(id);
      return true;
    }
    return runTransaction("readwrite", false, (store, resolve) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const current = request.result as
          DocumentSyncQueueOperation | undefined;
        if (current?.revision !== revision) {
          resolve(false);
          return;
        }
        store.delete(id);
        resolve(true);
      };
    });
  },

  async markRetryIfRevision(id, revision, attempts, nextAttemptAt, lastError) {
    if (!hasIndexedDb()) {
      const current = memoryOperations.get(id);
      if (current?.revision !== revision) {
        return false;
      }
      memoryOperations.set(id, {
        ...current,
        attempts,
        nextAttemptAt,
        lastError,
      });
      return true;
    }
    return runTransaction("readwrite", false, (store, resolve) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const current = request.result as
          DocumentSyncQueueOperation | undefined;
        if (current?.revision !== revision) {
          resolve(false);
          return;
        }
        store.put({
          ...current,
          attempts,
          nextAttemptAt,
          lastError,
        } satisfies DocumentSyncQueueOperation);
        resolve(true);
      };
    });
  },

  async makeScopeDue(scope) {
    const now = Date.now();
    if (!hasIndexedDb()) {
      for (const [id, operation] of memoryOperations) {
        if (operation.scope === scope) {
          memoryOperations.set(id, {
            ...operation,
            nextAttemptAt: now,
          });
        }
      }
      return;
    }
    await runTransaction("readwrite", undefined, (store, resolve) => {
      const request = store.index(SCOPE_INDEX).getAll(IDBKeyRange.only(scope));
      request.onsuccess = () => {
        for (const operation of request.result as DocumentSyncQueueOperation[]) {
          store.put({ ...operation, nextAttemptAt: now });
        }
        resolve(undefined);
      };
    });
  },

  async clearAll() {
    memoryOperations.clear();
    if (!hasIndexedDb()) {
      return;
    }
    await runTransaction("readwrite", undefined, (store, resolve) => {
      store.clear();
      resolve(undefined);
    });
  },
};

async function putDesiredOperation(
  scope: string,
  workspaceId: string,
  documentId: string,
  kind: DocumentSyncOperationKind,
  document?: MoctesDocument,
): Promise<DocumentSyncQueueOperation> {
  const id = operationId(scope, getSyncClientId(), documentId);
  const now = new Date().toISOString();
  const createOperation = (
    current?: DocumentSyncQueueOperation,
  ): DocumentSyncQueueOperation => ({
    id,
    revision: createRevision(),
    scope,
    workspaceId,
    documentId,
    kind,
    document: document ? structuredClone(document) : undefined,
    attempts: 0,
    nextAttemptAt: Date.now(),
    lastError: null,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  });

  if (!hasIndexedDb()) {
    const operation = createOperation(memoryOperations.get(id));
    memoryOperations.set(id, cloneOperation(operation));
    return operation;
  }

  const storedOperation =
    await runTransaction<DocumentSyncQueueOperation | null>(
      "readwrite",
      null,
      (store, resolve) => {
        const request = store.get(id);
        request.onsuccess = () => {
          const operation = createOperation(
            request.result as DocumentSyncQueueOperation | undefined,
          );
          store.put(operation);
          resolve(operation);
        };
      },
    );
  if (!storedOperation) {
    throw new Error("The document sync operation could not be stored.");
  }
  return storedOperation;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex(SCOPE_INDEX, "scope", { unique: false });
      }
    };
    request.onerror = () =>
      reject(
        request.error ?? new Error("Could not open the document sync queue."),
      );
    request.onblocked = () =>
      reject(new Error("The document sync queue database is blocked."));
    request.onsuccess = () => resolve(request.result);
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  fallback: T,
  action: (store: IDBObjectStore, resolve: (value: T) => void) => void,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result = fallback;
    action(store, (value) => {
      result = value;
    });
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(
        transaction.error ??
          new Error("Document sync queue transaction failed."),
      );
    };
    transaction.onabort = () => {
      database.close();
      reject(
        transaction.error ??
          new Error("Document sync queue transaction aborted."),
      );
    };
  });
}

function operationId(
  scope: string,
  clientId: string,
  documentId: string,
): string {
  return `${scope}\u0000${clientId}\u0000${documentId}`;
}

function getSyncClientId(): string {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return "memory-client";
  }
  const current = window.sessionStorage.getItem(CLIENT_ID_KEY);
  if (current) {
    return current;
  }
  const created =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.sessionStorage.setItem(CLIENT_ID_KEY, created);
  return created;
}

function createRevision(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneOperation(
  operation: DocumentSyncQueueOperation,
): DocumentSyncQueueOperation {
  return structuredClone(operation);
}

function compareOperations(
  first: DocumentSyncQueueOperation,
  second: DocumentSyncQueueOperation,
): number {
  return (
    first.createdAt.localeCompare(second.createdAt) ||
    first.documentId.localeCompare(second.documentId)
  );
}
