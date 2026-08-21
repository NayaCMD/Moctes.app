import { beforeEach, describe, expect, it } from "vitest";
import { useDocumentStore } from "../../stores/useDocumentStore";
import { documentSyncQueue } from "./documentSyncQueue";

describe("IndexedDB document sync queue", () => {
  beforeEach(async () => {
    await documentSyncQueue.clearAll();
    window.sessionStorage.removeItem("moctes-document-sync-client");
  });

  it("coalesces multiple edits into the newest desired document", async () => {
    const document = useDocumentStore.getState().documents[0];
    const first = await documentSyncQueue.enqueueUpsert(
      "user-1:workspace-1",
      "workspace-1",
      document,
    );
    const second = await documentSyncQueue.enqueueUpsert(
      "user-1:workspace-1",
      "workspace-1",
      { ...document, title: "Latest title" },
    );

    const queued = await documentSyncQueue.list("user-1:workspace-1");
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      kind: "upsert",
      attempts: 0,
      document: { title: "Latest title" },
    });
    expect(second.revision).not.toBe(first.revision);
  });

  it("does not let an old response remove a newer queued revision", async () => {
    const document = useDocumentStore.getState().documents[0];
    const first = await documentSyncQueue.enqueueUpsert(
      "user-1:workspace-1",
      "workspace-1",
      document,
    );
    const second = await documentSyncQueue.enqueueUpsert(
      "user-1:workspace-1",
      "workspace-1",
      { ...document, title: "Newer edit" },
    );

    await expect(
      documentSyncQueue.removeIfRevision(first.id, first.revision),
    ).resolves.toBe(false);
    expect(await documentSyncQueue.list("user-1:workspace-1")).toHaveLength(1);
    await expect(
      documentSyncQueue.removeIfRevision(second.id, second.revision),
    ).resolves.toBe(true);
  });

  it("isolates scopes and persists retry metadata", async () => {
    const document = useDocumentStore.getState().documents[0];
    const operation = await documentSyncQueue.enqueueUpsert(
      "user-1:workspace-1",
      "workspace-1",
      document,
    );
    await documentSyncQueue.enqueueDelete(
      "user-2:workspace-2",
      "workspace-2",
      document.id,
    );
    await documentSyncQueue.markRetryIfRevision(
      operation.id,
      operation.revision,
      3,
      Date.now() + 30_000,
      "Service unavailable",
    );

    const firstScope = await documentSyncQueue.list("user-1:workspace-1");
    const secondScope = await documentSyncQueue.list("user-2:workspace-2");
    expect(firstScope).toHaveLength(1);
    expect(firstScope[0]).toMatchObject({
      attempts: 3,
      lastError: "Service unavailable",
    });
    expect(secondScope).toHaveLength(1);
    expect(secondScope[0]).toMatchObject({
      kind: "delete",
      document: undefined,
    });
  });

  it("keeps independent desired operations for separate browser tabs", async () => {
    const document = useDocumentStore.getState().documents[0];
    const firstTab = await documentSyncQueue.enqueueUpsert(
      "user-1:workspace-1",
      "workspace-1",
      { ...document, title: "Alteração da aba A" },
    );

    window.sessionStorage.removeItem("moctes-document-sync-client");
    const secondTab = await documentSyncQueue.enqueueUpsert(
      "user-1:workspace-1",
      "workspace-1",
      { ...document, title: "Alteração da aba B" },
    );

    expect(secondTab.id).not.toBe(firstTab.id);
    const queued = await documentSyncQueue.list("user-1:workspace-1");
    expect(queued).toHaveLength(2);
    expect(queued.map((operation) => operation.document?.title)).toEqual(
      expect.arrayContaining(["Alteração da aba A", "Alteração da aba B"]),
    );
  });
});
