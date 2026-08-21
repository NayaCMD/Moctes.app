import { create } from "zustand";
import type { PageElement } from "../types/element.types";

export interface CollaborationParticipant {
  socketId: string;
  user: { id: string; name: string };
  color: string;
}

export interface RemoteCursor {
  user: { id: string; name: string };
  color: string;
  cursor: { pageId: string; x: number; y: number };
  at: string;
}

export interface RemoteElementPreview {
  user: { id: string; name: string };
  color: string;
  elementId: string;
  preview: Partial<
    Pick<PageElement, "x" | "y" | "width" | "height" | "rotation">
  >;
}

interface CollaborationState {
  phase: "disconnected" | "connecting" | "connected" | "error";
  documentId: string | null;
  sequence: number;
  participants: CollaborationParticipant[];
  cursors: Record<string, RemoteCursor>;
  elementPreviews: Record<string, RemoteElementPreview>;
  error: string | null;
  setConnection: (
    phase: CollaborationState["phase"],
    documentId?: string | null,
    error?: string | null,
  ) => void;
  setSequence: (sequence: number) => void;
  setParticipants: (participants: CollaborationParticipant[]) => void;
  setCursor: (cursor: RemoteCursor) => void;
  setElementPreview: (preview: RemoteElementPreview) => void;
  clearElementPreview: (elementId: string) => void;
  reset: () => void;
}

const initialState = {
  phase: "disconnected" as const,
  documentId: null,
  sequence: 0,
  participants: [] as CollaborationParticipant[],
  cursors: {} as Record<string, RemoteCursor>,
  elementPreviews: {} as Record<string, RemoteElementPreview>,
  error: null,
};

export const useCollaborationStore = create<CollaborationState>((set) => ({
  ...initialState,
  setConnection: (phase, documentId = null, error = null) =>
    set({ phase, documentId, error }),
  setSequence: (sequence) =>
    set((state) => ({ sequence: Math.max(state.sequence, sequence) })),
  setParticipants: (participants) =>
    set((state) => {
      const activeUserIds = new Set(
        participants.map((participant) => participant.user.id),
      );
      return {
        participants,
        cursors: Object.fromEntries(
          Object.entries(state.cursors).filter(([userId]) =>
            activeUserIds.has(userId),
          ),
        ),
        elementPreviews: Object.fromEntries(
          Object.entries(state.elementPreviews).filter(([, preview]) =>
            activeUserIds.has(preview.user.id),
          ),
        ),
      };
    }),
  setCursor: (cursor) =>
    set((state) => ({
      cursors: { ...state.cursors, [cursor.user.id]: cursor },
    })),
  setElementPreview: (preview) =>
    set((state) => ({
      elementPreviews: {
        ...state.elementPreviews,
        [preview.elementId]: preview,
      },
    })),
  clearElementPreview: (elementId) =>
    set((state) => {
      const elementPreviews = { ...state.elementPreviews };
      delete elementPreviews[elementId];
      return { elementPreviews };
    }),
  reset: () => set(initialState),
}));
