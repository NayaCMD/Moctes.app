import { io, type Socket } from "socket.io-client";
import { useAuthStore, type WorkspaceRole } from "../stores/useAuthStore";
import { useCollaborationStore } from "../stores/useCollaborationStore";
import { useDocumentStore } from "../stores/useDocumentStore";
import { useEditorStore } from "../stores/useEditorStore";
import type { MoctesDocument } from "../types/document.types";
import {
  createPatches,
  type HistoryPatch,
} from "../utils/history.utils";
import { API_BASE_URL } from "./apiClient";
import {
  applyRealtimeDocumentPatches,
  applyRealtimeDocumentDeletion,
  applyRealtimeDocumentSnapshot,
  queueCurrentDocumentForPersistence,
  rememberRealtimeCollaborationSequence,
  rememberRealtimeDocumentVersion,
  type PersistedDocumentRecord,
} from "./documentPersistence";
import {
  clearRealtimeManagedDocuments,
  setRealtimeManaged,
} from "./collaborationRuntime";

interface CollaborationOperation {
  documentId: string;
  sequence: number;
  operationId: string;
  clientId: string;
  baseSequence: number;
  version?: number;
  patches: HistoryPatch[];
  actorId: string;
  createdAt: string;
}

interface CollaborationSnapshot extends PersistedDocumentRecord {
  documentId: string;
  workspaceId: string;
  role: WorkspaceRole;
  sequence: number;
  operations: CollaborationOperation[];
}

interface PresenceUpdate {
  documentId: string;
  participants: Array<{
    socketId: string;
    user: { id: string; name: string };
    color: string;
  }>;
}

interface CursorUpdate {
  documentId: string;
  user: { id: string; name: string };
  color: string;
  cursor: { pageId: string; x: number; y: number };
  at: string;
}

let socket: Socket | null = null;
let activeDocumentId: string | null = null;
let activeRole: WorkspaceRole | null = null;
let unsubscribeDocuments: (() => void) | null = null;
let unsubscribeInteraction: (() => void) | null = null;
let applyingRemoteOperation = false;
let lastCursorSentAt = 0;
let lastPreviewSentAt = 0;
let operationSubmissionChain = Promise.resolve();
const pendingOperationIds = new Set<string>();
const clientId = getClientId();

export function startDocumentCollaboration(options: {
  documentId: string;
  role: WorkspaceRole;
}): void {
  if (
    activeDocumentId === options.documentId &&
    socket &&
    !socket.disconnected
  ) {
    return;
  }
  stopDocumentCollaboration();
  activeDocumentId = options.documentId;
  activeRole = options.role;
  useCollaborationStore
    .getState()
    .setConnection("connecting", options.documentId);

  const origin = new URL(API_BASE_URL).origin;
  socket = io(`${origin}/collaboration`, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
  });

  socket.on("collaboration:ready", () => void joinActiveDocument());
  socket.on("disconnect", () => {
    if (activeDocumentId) setRealtimeManaged(activeDocumentId, false);
    useCollaborationStore
      .getState()
      .setConnection("disconnected", activeDocumentId);
  });
  socket.on("connect_error", (error) => {
    if (activeDocumentId) setRealtimeManaged(activeDocumentId, false);
    useCollaborationStore
      .getState()
      .setConnection("error", activeDocumentId, error.message);
  });
  socket.on("presence:updated", (update: PresenceUpdate) => {
    if (update.documentId === activeDocumentId) {
      useCollaborationStore.getState().setParticipants(update.participants);
    }
  });
  socket.on("cursor:updated", (update: CursorUpdate) => {
    if (
      update.documentId === activeDocumentId &&
      update.user.id !== useAuthStore.getState().user?.id
    ) {
      useCollaborationStore.getState().setCursor(update);
    }
  });
  socket.on(
    "interaction:previewed",
    (update: {
      documentId: string;
      user: { id: string; name: string };
      color: string;
      elementId: string;
      preview: Record<string, number>;
    }) => {
      if (
        update.documentId === activeDocumentId &&
        update.user.id !== useAuthStore.getState().user?.id
      ) {
        useCollaborationStore.getState().setElementPreview(update);
      }
    },
  );
  socket.on(
    "interaction:ended",
    (update: { documentId: string; elementId: string }) => {
      if (update.documentId === activeDocumentId) {
        useCollaborationStore.getState().clearElementPreview(update.elementId);
      }
    },
  );
  socket.on("operation:applied", (operation: CollaborationOperation) => {
    if (operation.documentId !== activeDocumentId) return;
    useCollaborationStore.getState().setSequence(operation.sequence);
    rememberRealtimeCollaborationSequence(
      operation.documentId,
      operation.sequence,
    );
    if (typeof operation.version === "number") {
      rememberRealtimeDocumentVersion(operation.documentId, operation.version);
    }
    if (pendingOperationIds.delete(operation.operationId)) return;
    applyingRemoteOperation = true;
    try {
      applyRealtimeDocumentPatches(operation.documentId, operation.patches);
    } finally {
      applyingRemoteOperation = false;
    }
  });
  socket.on("document:snapshot", (record: PersistedDocumentRecord) => {
    if (record.id !== activeDocumentId) return;
    applyingRemoteOperation = true;
    try {
      applyRealtimeDocumentSnapshot(record);
      if (record.collaborationSequence !== undefined) {
        useCollaborationStore
          .getState()
          .setSequence(record.collaborationSequence);
      }
    } finally {
      applyingRemoteOperation = false;
    }
  });
  socket.on("document:deleted", ({ documentId }: { documentId: string }) => {
    if (documentId === activeDocumentId) {
      stopDocumentCollaboration();
      applyRealtimeDocumentDeletion(documentId);
    }
  });
}

export function stopDocumentCollaboration(): void {
  const previousDocumentId = activeDocumentId;
  unsubscribeDocuments?.();
  unsubscribeDocuments = null;
  unsubscribeInteraction?.();
  unsubscribeInteraction = null;
  if (socket) {
    socket.emit("document:leave");
    socket.disconnect();
    socket = null;
  }
  if (previousDocumentId) setRealtimeManaged(previousDocumentId, false);
  clearRealtimeManagedDocuments();
  activeDocumentId = null;
  activeRole = null;
  pendingOperationIds.clear();
  operationSubmissionChain = Promise.resolve();
  useCollaborationStore.getState().reset();
}

export function sendCollaborationCursor(cursor: {
  pageId: string;
  x: number;
  y: number;
}): void {
  if (!socket?.connected || !activeDocumentId) return;
  const now = performance.now();
  if (now - lastCursorSentAt < 50) return;
  lastCursorSentAt = now;
  socket.emit("cursor:update", cursor);
}

async function joinActiveDocument(): Promise<void> {
  const documentId = activeDocumentId;
  if (!socket || !documentId) return;
  try {
    const snapshot = (await socket.timeout(10_000).emitWithAck("document:join", {
      documentId,
      afterSequence: useCollaborationStore.getState().sequence,
    })) as CollaborationSnapshot;
    if (documentId !== activeDocumentId) return;
    applyingRemoteOperation = true;
    try {
      applyRealtimeDocumentSnapshot({
        id: documentId,
        version: snapshot.version,
        collaborationSequence: snapshot.sequence,
        document: snapshot.document,
        createdAt: snapshot.createdAt ?? snapshot.updatedAt,
        updatedAt: snapshot.updatedAt,
      });
    } finally {
      applyingRemoteOperation = false;
    }
    useCollaborationStore.getState().setSequence(snapshot.sequence);
    useCollaborationStore
      .getState()
      .setConnection("connected", documentId);
    setRealtimeManaged(documentId, activeRole !== "VIEWER");
    subscribeToDocumentChanges();
    subscribeToInteractionPreviews();
  } catch (error) {
    setRealtimeManaged(documentId, false);
    useCollaborationStore
      .getState()
      .setConnection(
        "error",
        documentId,
        error instanceof Error ? error.message : "Falha ao entrar na coedicao.",
      );
  }
}

function subscribeToInteractionPreviews(): void {
  unsubscribeInteraction?.();
  unsubscribeInteraction = useEditorStore.subscribe((state, previous) => {
    if (!socket?.connected || activeRole === "VIEWER") return;
    const interaction = state.interaction;
    if (
      interaction.mode !== "idle" &&
      interaction.elementId &&
      interaction.preview &&
      interaction !== previous.interaction
    ) {
      const now = performance.now();
      if (now - lastPreviewSentAt >= 32) {
        lastPreviewSentAt = now;
        socket.emit("interaction:preview", {
          elementId: interaction.elementId,
          preview: pickTransformPreview(interaction.preview),
        });
      }
      return;
    }
    if (
      interaction.mode === "idle" &&
      previous.interaction.mode !== "idle" &&
      previous.interaction.elementId
    ) {
      socket.emit("interaction:end", {
        elementId: previous.interaction.elementId,
      });
    }
  });
}

function pickTransformPreview(
  preview: Record<string, unknown>,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const key of ["x", "y", "width", "height", "rotation"] as const) {
    const value = preview[key];
    if (typeof value === "number" && Number.isFinite(value)) result[key] = value;
  }
  return result;
}

function subscribeToDocumentChanges(): void {
  unsubscribeDocuments?.();
  unsubscribeDocuments = useDocumentStore.subscribe((state, previous) => {
    const documentId = activeDocumentId;
    if (
      applyingRemoteOperation ||
      !documentId ||
      activeRole === "VIEWER" ||
      !socket?.connected
    ) {
      return;
    }
    const before = previous.documents.find((item) => item.id === documentId);
    const after = state.documents.find((item) => item.id === documentId);
    if (!before || !after || before === after) return;
    const patches = createPatches(before, after);
    if (patches.length === 0) return;
    operationSubmissionChain = operationSubmissionChain
      .catch(() => undefined)
      .then(() => submitOperation(documentId, patches));
  });
}

async function submitOperation(
  documentId: string,
  patches: HistoryPatch[],
): Promise<void> {
  if (!socket?.connected) {
    setRealtimeManaged(documentId, false);
    await queueCurrentDocumentForPersistence(documentId);
    return;
  }
  const operationId = crypto.randomUUID();
  pendingOperationIds.add(operationId);
  try {
    const response = (await socket.timeout(10_000).emitWithAck(
      "operation:submit",
      {
        documentId,
        operationId,
        clientId,
        baseSequence: useCollaborationStore.getState().sequence,
        patches,
      },
    )) as CollaborationOperation;
    useCollaborationStore.getState().setSequence(response.sequence);
    rememberRealtimeCollaborationSequence(documentId, response.sequence);
    if (typeof response.version === "number") {
      rememberRealtimeDocumentVersion(documentId, response.version);
    }
  } catch (error) {
    pendingOperationIds.delete(operationId);
    setRealtimeManaged(documentId, false);
    await queueCurrentDocumentForPersistence(documentId);
    useCollaborationStore
      .getState()
      .setConnection(
        "error",
        documentId,
        error instanceof Error ? error.message : "Falha ao enviar alteracao.",
      );
  }
}

function getClientId(): string {
  const key = "moctes-collaboration-client";
  const current = sessionStorage.getItem(key);
  if (current) return current;
  const created = crypto.randomUUID();
  sessionStorage.setItem(key, created);
  return created;
}

export function isCollaborationDocument(value: unknown): value is MoctesDocument {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "pages" in value &&
    Array.isArray(value.pages)
  );
}
