import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStores } from "../test/helpers/resetStores";
import { useDocumentStore } from "../stores/useDocumentStore";
import { useDocumentSyncStore } from "../stores/useDocumentSyncStore";
import * as apiClient from "./apiClient";
import {
  flushDocumentPersistence,
  loadDocumentConflictDetails,
  resolveDocumentConflict,
  restoreDocumentRevision,
  retryDocumentPersistence,
  startDocumentPersistence,
  stopDocumentPersistence,
  toCreateDocumentPayload,
  type CreateDocumentPayload,
  type PersistedDocumentRecord,
  type UpdateDocumentPayload,
} from "./documentPersistence";
import { documentSyncQueue } from "./sync/documentSyncQueue";

vi.mock("./apiClient", async () => {
  const actual =
    await vi.importActual<typeof import("./apiClient")>("./apiClient");
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPut: vi.fn(),
    apiDelete: vi.fn(),
  };
});

const apiGet = vi.mocked(apiClient.apiGet);
const apiPost = vi.mocked(apiClient.apiPost);
const apiPut = vi.mocked(apiClient.apiPut);
const apiDelete = vi.mocked(apiClient.apiDelete);

describe("document persistence", () => {
  beforeEach(async () => {
    stopDocumentPersistence();
    resetStores();
    vi.useRealTimers();
    vi.clearAllMocks();
    window.localStorage.clear();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    await documentSyncQueue.clearAll();
    apiDelete.mockResolvedValue({ ok: true, data: null });
  });

  it("creates API payload from the canonical document", () => {
    const document = useDocumentStore.getState().documents[0];
    expect(toCreateDocumentPayload(document, "workspace-1")).toEqual({
      workspaceId: "workspace-1",
      id: document.id,
      title: document.title,
      type: document.type,
      schemaVersion: 3,
      document,
    });
  });

  it("removes expiring URLs before a document enters the sync queue", () => {
    const document = structuredClone(useDocumentStore.getState().documents[0]);
    const element = document.pages
      .flatMap((page) => page.elements)
      .find(
        (item) =>
          item.content.kind === "image" ||
          item.content.kind === "sticker" ||
          item.content.kind === "tape",
      );
    if (
      !element ||
      (element.content.kind !== "image" &&
        element.content.kind !== "sticker" &&
        element.content.kind !== "tape")
    ) {
      throw new Error("Fixture does not contain an asset element.");
    }
    element.content = {
      ...element.content,
      assetId: "remote-asset-id",
      src: "https://storage.example/temporary-signature",
    };

    const payload = toCreateDocumentPayload(document, "workspace-1");
    const migrated = payload.document.pages
      .flatMap((page) => page.elements)
      .find((item) => item.id === element.id);

    expect(migrated?.content).toMatchObject({
      assetId: "remote-asset-id",
      src: "asset://remote-asset-id",
    });
  });

  it("moves initial documents through the durable queue", async () => {
    apiGet.mockResolvedValue({ ok: true, data: [] });
    apiPost.mockImplementation(async (_path, body) => {
      const payload = body as CreateDocumentPayload;
      return { ok: true, data: record(payload.document, 1) };
    });

    await startDocumentPersistence("workspace-1", "user-1");

    expect(apiPost).toHaveBeenCalledTimes(
      useDocumentStore.getState().documents.length,
    );
    expect(await documentSyncQueue.list("user-1:workspace-1")).toHaveLength(0);
    expect(useDocumentSyncStore.getState()).toMatchObject({
      phase: "synced",
      pendingOperations: 0,
    });
  });

  it("autosaves queued changes using optimistic versioning", async () => {
    configureSuccessfulBootstrap();
    await startDocumentPersistence("workspace-1", "user-1");
    const document = useDocumentStore.getState().documents[0];

    useDocumentStore
      .getState()
      .updateDocument(document.id, { title: "Persistido" });
    await flushDocumentPersistence();

    expect(apiPut).toHaveBeenCalledWith(
      `/documents/${encodeURIComponent(document.id)}`,
      expect.objectContaining({ expectedVersion: 1 }),
    );
    expect(await documentSyncQueue.list("user-1:workspace-1")).toHaveLength(0);
  });

  it("retries transient failures and drains the queue", async () => {
    configureSuccessfulBootstrap();
    await startDocumentPersistence("workspace-1", "user-1");
    const document = useDocumentStore.getState().documents[0];
    apiPut
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        error: "Unavailable",
        retryAfterMs: 10,
      })
      .mockImplementation(async (_path, body) => {
        const payload = body as UpdateDocumentPayload;
        return { ok: true, data: record(payload.document, 2) };
      });

    useDocumentStore
      .getState()
      .updateDocument(document.id, { title: "Retry me" });
    await flushDocumentPersistence();
    expect(useDocumentSyncStore.getState()).toMatchObject({
      phase: "waiting-retry",
      retryAttempt: 1,
      pendingOperations: 1,
    });

    await vi.waitFor(() => expect(apiPut).toHaveBeenCalledTimes(2), {
      timeout: 1_000,
    });
    await vi.waitFor(
      () => expect(useDocumentSyncStore.getState().phase).toBe("synced"),
      { timeout: 1_000 },
    );
    expect(await documentSyncQueue.list("user-1:workspace-1")).toHaveLength(0);
  });

  it("keeps work queued offline and resumes on the online event", async () => {
    configureSuccessfulBootstrap();
    await startDocumentPersistence("workspace-1", "user-1");
    const document = useDocumentStore.getState().documents[0];
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    useDocumentStore.getState().updateDocument(document.id, {
      title: "Edited offline",
    });
    await flushDocumentPersistence();

    expect(apiPut).not.toHaveBeenCalled();
    expect(useDocumentSyncStore.getState()).toMatchObject({
      phase: "offline",
      pendingOperations: 1,
    });

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(useDocumentSyncStore.getState().phase).toBe("synced"),
    );
  });

  it("restores an unsent edit from IndexedDB after the sync service restarts", async () => {
    const serverDocuments = new Map<string, PersistedDocumentRecord>();
    apiGet.mockImplementation(async (path) => {
      if (path.startsWith("/documents?")) {
        return { ok: true, data: [...serverDocuments.values()] };
      }
      const id = decodeURIComponent(path.slice("/documents/".length));
      const remote = serverDocuments.get(id);
      return remote
        ? { ok: true, data: remote }
        : { ok: false, status: 404, error: "Not found" };
    });
    apiPost.mockImplementation(async (_path, body) => {
      const payload = body as CreateDocumentPayload;
      const created = record(payload.document, 1);
      serverDocuments.set(payload.id, created);
      return { ok: true, data: created };
    });
    apiPut.mockResolvedValue({
      ok: false,
      status: 503,
      error: "Offline",
      retryAfterMs: 60_000,
    });

    await startDocumentPersistence("workspace-1", "user-1");
    const document = useDocumentStore.getState().documents[0];
    useDocumentStore.getState().updateDocument(document.id, {
      title: "Survives restart",
    });
    await flushDocumentPersistence();
    expect(await documentSyncQueue.list("user-1:workspace-1")).toHaveLength(1);
    stopDocumentPersistence();

    apiPut.mockImplementation(async (_path, body) => {
      const payload = body as UpdateDocumentPayload;
      const updated = record(payload.document, 2);
      serverDocuments.set(payload.document.id, updated);
      return { ok: true, data: updated };
    });
    await startDocumentPersistence("workspace-1", "user-1");

    expect(
      useDocumentStore
        .getState()
        .documents.find((item) => item.id === document.id)?.title,
    ).toBe("Survives restart");
    await retryDocumentPersistence();
    expect(await documentSyncQueue.list("user-1:workspace-1")).toHaveLength(0);
  });

  it("reconciles a response lost after a successful server write", async () => {
    configureSuccessfulBootstrap();
    await startDocumentPersistence("workspace-1", "user-1");
    const document = useDocumentStore.getState().documents[0];
    let desiredDocument = document;
    apiPut.mockImplementation(async (_path, body) => {
      desiredDocument = (body as UpdateDocumentPayload).document;
      return { ok: false, status: 409, error: "Version conflict" };
    });
    apiGet.mockImplementation(async (path) => {
      if (path.startsWith("/documents?")) {
        return { ok: true, data: [] };
      }
      return { ok: true, data: record(desiredDocument, 2) };
    });

    useDocumentStore
      .getState()
      .updateDocument(document.id, { title: "Applied" });
    await flushDocumentPersistence();

    expect(useDocumentSyncStore.getState().phase).toBe("synced");
    expect(await documentSyncQueue.list("user-1:workspace-1")).toHaveLength(0);
  });

  it("shows both divergent versions and accepts the server version", async () => {
    configureSuccessfulBootstrap();
    await startDocumentPersistence("workspace-1", "user-1");
    const original = useDocumentStore.getState().documents[0];
    const remoteDocument = {
      ...original,
      title: "Servidor",
      updatedAt: "2026-08-11T10:00:00.000Z",
    };
    apiPut.mockResolvedValue({
      ok: false,
      status: 409,
      error: "Version conflict",
    });
    apiGet.mockResolvedValue({ ok: true, data: record(remoteDocument, 4) });

    useDocumentStore.getState().updateDocument(original.id, {
      title: "Minha alteração",
    });
    await flushDocumentPersistence();

    expect(useDocumentSyncStore.getState()).toMatchObject({
      phase: "conflict",
      conflictDocumentIds: [original.id],
    });
    const details = await loadDocumentConflictDetails(original.id);
    expect(details).toMatchObject({
      ok: true,
      data: {
        documentId: original.id,
        operationKind: "upsert",
        localDocument: { title: "Minha alteração" },
        remoteRecord: { version: 4, document: { title: "Servidor" } },
      },
    });

    expect(await resolveDocumentConflict(original.id, "remote")).toEqual({
      ok: true,
      data: null,
    });
    expect(
      useDocumentStore
        .getState()
        .documents.find((document) => document.id === original.id)?.title,
    ).toBe("Servidor");
    expect(await documentSyncQueue.list("user-1:workspace-1")).toHaveLength(0);
    expect(useDocumentSyncStore.getState()).toMatchObject({
      phase: "synced",
      conflictDocumentIds: [],
    });
  });

  it("rebases the local version on the latest server version when requested", async () => {
    configureSuccessfulBootstrap();
    await startDocumentPersistence("workspace-1", "user-1");
    const original = useDocumentStore.getState().documents[0];
    const remoteDocument = { ...original, title: "Servidor" };
    apiPut
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        error: "Version conflict",
      })
      .mockImplementation(async (_path, body) => {
        const payload = body as UpdateDocumentPayload;
        return { ok: true, data: record(payload.document, 6) };
      });
    apiGet.mockResolvedValue({ ok: true, data: record(remoteDocument, 5) });

    useDocumentStore.getState().updateDocument(original.id, {
      title: "Minha alteração",
    });
    await flushDocumentPersistence();
    expect(useDocumentSyncStore.getState().phase).toBe("conflict");

    expect(await resolveDocumentConflict(original.id, "local")).toEqual({
      ok: true,
      data: null,
    });
    expect(apiPut).toHaveBeenLastCalledWith(
      `/documents/${encodeURIComponent(original.id)}`,
      expect.objectContaining({
        expectedVersion: 5,
        document: expect.objectContaining({ title: "Minha alteração" }),
      }),
    );
    expect(await documentSyncQueue.list("user-1:workspace-1")).toHaveLength(0);
    expect(useDocumentSyncStore.getState().phase).toBe("synced");
  });

  it("restores a revision and replaces any pending local operation atomically", async () => {
    configureSuccessfulBootstrap();
    await startDocumentPersistence("workspace-1", "user-1");
    const original = useDocumentStore.getState().documents[0];
    const restoredDocument = {
      ...original,
      title: "Conteúdo recuperado",
      updatedAt: "2026-08-11T11:00:00.000Z",
    };
    apiPost.mockResolvedValue({
      ok: true,
      data: record(restoredDocument, 3),
    });

    useDocumentStore.getState().updateDocument(original.id, {
      title: "Edição ainda local",
    });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(await documentSyncQueue.list("user-1:workspace-1")).toHaveLength(1);

    const response = await restoreDocumentRevision(original.id, 1, 2);

    expect(response).toMatchObject({ ok: true, data: { version: 3 } });
    expect(apiPost).toHaveBeenCalledWith(
      `/documents/${encodeURIComponent(original.id)}/revisions/1/restore`,
      { expectedVersion: 2, expectedCollaborationSequence: 0 },
    );
    expect(
      useDocumentStore
        .getState()
        .documents.find((document) => document.id === original.id)?.title,
    ).toBe("Conteúdo recuperado");
    expect(await documentSyncQueue.list("user-1:workspace-1")).toHaveLength(0);
  });
});

function configureSuccessfulBootstrap(): void {
  apiGet.mockResolvedValue({ ok: true, data: [] });
  apiPost.mockImplementation(async (_path, body) => {
    const payload = body as CreateDocumentPayload;
    return { ok: true, data: record(payload.document, 1) };
  });
  apiPut.mockImplementation(async (_path, body) => {
    const payload = body as UpdateDocumentPayload;
    return {
      ok: true,
      data: record(payload.document, payload.expectedVersion + 1),
    };
  });
}

function record(
  document: PersistedDocumentRecord["document"],
  version: number,
): PersistedDocumentRecord {
  return {
    id: document.id,
    version,
    collaborationSequence: 0,
    document,
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z",
  };
}
