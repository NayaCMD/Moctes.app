import { create } from "zustand";
import {
  initialDocumentSyncMachineState,
  reduceDocumentSyncState,
  type DocumentSyncEvent,
  type DocumentSyncMachineState,
} from "../services/sync/documentSyncMachine";

export interface DocumentSyncState extends DocumentSyncMachineState {
  dispatch: (event: DocumentSyncEvent) => void;
}

export const useDocumentSyncStore = create<DocumentSyncState>()((set) => ({
  ...initialDocumentSyncMachineState,
  dispatch: (event) => set((state) => reduceDocumentSyncState(state, event)),
}));
