import { beforeEach, describe, expect, it } from "vitest";
import { useCollaborationStore } from "./useCollaborationStore";

describe("useCollaborationStore", () => {
  beforeEach(() => useCollaborationStore.getState().reset());

  it("never moves the acknowledged sequence backwards", () => {
    useCollaborationStore.getState().setSequence(12);
    useCollaborationStore.getState().setSequence(8);

    expect(useCollaborationStore.getState().sequence).toBe(12);
  });

  it("removes cursors when a participant leaves", () => {
    const store = useCollaborationStore.getState();
    store.setParticipants([
      {
        socketId: "socket-a",
        user: { id: "user-a", name: "Ana" },
        color: "#000",
      },
    ]);
    store.setCursor({
      user: { id: "user-a", name: "Ana" },
      color: "#000",
      cursor: { pageId: "page-1", x: 10, y: 20 },
      at: new Date().toISOString(),
    });

    useCollaborationStore.getState().setParticipants([]);

    expect(useCollaborationStore.getState().cursors).toEqual({});
  });
});
