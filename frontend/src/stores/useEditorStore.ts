import { create } from "zustand";
import { clampEditorZoom } from "../config/documentGeometry";
import type { AssetCategory } from "../types/asset.types";
import type { MoctesDocument } from "../types/document.types";
import type { ActiveToolPanel, DrawingToolSettings, EditorMode, RulerState, ZoomMode } from "../types/editor.types";
import type { DrawingPoint, PageElement, PageElementType } from "../types/element.types";
import type { NotebookBookState, NotebookTransitionState } from "../types/notebook.types";
import { cloneDocuments, pushHistorySnapshot } from "../utils/history.utils";

export type EditorInteractionMode = "idle" | "dragging" | "resizing" | "rotating";

export interface EditorInteractionState {
  mode: EditorInteractionMode;
  elementId: string | null;
  preview: Partial<PageElement> | null;
}

export interface ContextMenuState {
  open: boolean;
  elementId: string | null;
  x: number;
  y: number;
}

export interface VisibilityFilters {
  text: boolean;
  image: boolean;
  sticker: boolean;
  tape: boolean;
  postIt: boolean;
  comment: boolean;
  hidden: boolean;
}

export interface AssetDragState {
  status: "idle" | "dragging";
  assetId: string | null;
  assetType: PageElementType | null;
  sourceCategory: AssetCategory | null;
  previewSrc: string | null;
  previewAlt: string | null;
  pointerX: number;
  pointerY: number;
  targetPageId: string | null;
  targetDocumentId: string | null;
  validDrop: boolean;
}

export interface ElementTransferPreview {
  elementId: string;
  sourcePageId: string;
  targetPageId: string | null;
  x: number;
  y: number;
  validTarget: boolean;
}

export interface DrawingPreviewState {
  pageId: string;
  points: DrawingPoint[];
  color: string;
  width: number;
  opacity: number;
  guided: boolean;
}

interface EditorStoreState {
  editorMode: EditorMode;
  activeToolPanel: ActiveToolPanel;
  interaction: EditorInteractionState;
  transferPreview: ElementTransferPreview | null;
  drawingPreview: DrawingPreviewState | null;
  assetDrag: AssetDragState;
  drawingSettings: DrawingToolSettings;
  ruler: RulerState;
  clipboardElement: PageElement | null;
  pasteCount: number;
  undoStack: MoctesDocument[][];
  redoStack: MoctesDocument[][];
  contextMenu: ContextMenuState;
  visibilityPanelOpen: boolean;
  visibilityFilters: VisibilityFilters;
  editingTextElementId: string | null;
  editorZoom: number;
  zoomMode: ZoomMode;
  notebookBook: NotebookBookState | null;
  notebookTransition: NotebookTransitionState | null;
  setEditorMode: (mode: EditorMode) => void;
  setActiveToolPanel: (panel: ActiveToolPanel) => void;
  beginInteraction: (state: EditorInteractionState) => void;
  updatePreview: (preview: Partial<PageElement>) => void;
  endInteraction: () => void;
  setTransferPreview: (preview: ElementTransferPreview | null) => void;
  setDrawingPreview: (preview: DrawingPreviewState | null) => void;
  beginAssetDrag: (state: Omit<AssetDragState, "status" | "targetPageId" | "targetDocumentId" | "validDrop">) => void;
  updateAssetDragPointer: (pointerX: number, pointerY: number) => void;
  setAssetDragTarget: (target: Pick<AssetDragState, "targetPageId" | "targetDocumentId" | "validDrop">) => void;
  cancelAssetDrag: () => void;
  setClipboardElement: (element: PageElement | null) => void;
  incrementPasteCount: () => void;
  recordHistory: (documents: MoctesDocument[]) => void;
  undo: (current: MoctesDocument[]) => MoctesDocument[] | null;
  redo: (current: MoctesDocument[]) => MoctesDocument[] | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  openContextMenu: (elementId: string, x: number, y: number) => void;
  closeContextMenu: () => void;
  toggleVisibilityPanel: () => void;
  setVisibilityFilter: (key: keyof VisibilityFilters, value: boolean) => void;
  setEditingTextElementId: (elementId: string | null) => void;
  setEditorZoom: (zoom: number) => void;
  setZoomMode: (mode: ZoomMode) => void;
  fitEditorZoom: () => void;
  resetEditorZoom: () => void;
  openNotebook: (documentId: string) => boolean;
  completeNotebookOpening: (documentId: string) => void;
  closeNotebook: (documentId: string) => boolean;
  completeNotebookClosing: (documentId: string) => void;
  cancelNotebookBookTransition: (documentId?: string) => void;
  beginNotebookTransition: (transition: NotebookTransitionState) => boolean;
  startNotebookTransition: (transition: NotebookTransitionState) => boolean;
  completeNotebookTransition: (transition: NotebookTransitionState) => void;
  cancelNotebookTransition: (documentId?: string) => void;
  setDrawingSettings: (settings: Partial<DrawingToolSettings>) => void;
  setRuler: (state: Partial<RulerState>) => void;
  resetEditorSession: () => void;
  repositionContextMenu: (width: number, height: number) => void;
}

const defaultVisibilityFilters: VisibilityFilters = {
  text: true,
  image: true,
  sticker: true,
  tape: true,
  postIt: true,
  comment: true,
  hidden: false,
};

const idleAssetDrag: AssetDragState = {
  status: "idle",
  assetId: null,
  assetType: null,
  sourceCategory: null,
  previewSrc: null,
  previewAlt: null,
  pointerX: 0,
  pointerY: 0,
  targetPageId: null,
  targetDocumentId: null,
  validDrop: false,
};

const defaultDrawingSettings: DrawingToolSettings = {
  mode: "pen",
  color: "#526ed4",
  strokeWidth: 2.2,
  opacity: 0.9,
};

const defaultRuler: RulerState = {
  visible: false,
  x: 42,
  y: 52,
  rotation: 0,
  length: 64,
};

export const useEditorStore = create<EditorStoreState>()((set, get) => ({
  editorMode: "select",
  activeToolPanel: null,
  interaction: { mode: "idle", elementId: null, preview: null },
  transferPreview: null,
  drawingPreview: null,
  assetDrag: idleAssetDrag,
  drawingSettings: defaultDrawingSettings,
  ruler: defaultRuler,
  clipboardElement: null,
  pasteCount: 0,
  undoStack: [],
  redoStack: [],
  contextMenu: { open: false, elementId: null, x: 0, y: 0 },
  visibilityPanelOpen: false,
  visibilityFilters: defaultVisibilityFilters,
  editingTextElementId: null,
  editorZoom: 1,
  zoomMode: "fit",
  notebookBook: null,
  notebookTransition: null,
  setEditorMode: (editorMode) =>
    set({
      editorMode,
      contextMenu: { open: false, elementId: null, x: 0, y: 0 },
      interaction: { mode: "idle", elementId: null, preview: null },
      transferPreview: null,
    }),
  setActiveToolPanel: (activeToolPanel) =>
    set({ activeToolPanel, contextMenu: { open: false, elementId: null, x: 0, y: 0 } }),
  beginInteraction: (interaction) => set({ interaction }),
  updatePreview: (preview) =>
    set((state) => ({
      interaction: {
        ...state.interaction,
        preview: { ...state.interaction.preview, ...preview },
      },
    })),
  endInteraction: () =>
    set({ interaction: { mode: "idle", elementId: null, preview: null }, transferPreview: null }),
  setTransferPreview: (transferPreview) => set({ transferPreview }),
  setDrawingPreview: (drawingPreview) => set({ drawingPreview }),
  beginAssetDrag: (assetDrag) =>
    set({
      assetDrag: {
        ...assetDrag,
        status: "dragging",
        targetPageId: null,
        targetDocumentId: null,
        validDrop: false,
      },
      contextMenu: { open: false, elementId: null, x: 0, y: 0 },
    }),
  updateAssetDragPointer: (pointerX, pointerY) =>
    set((state) => ({
      assetDrag:
        state.assetDrag.status === "dragging"
          ? { ...state.assetDrag, pointerX, pointerY }
          : state.assetDrag,
    })),
  setAssetDragTarget: (target) =>
    set((state) => ({
      assetDrag:
        state.assetDrag.status === "dragging"
          ? { ...state.assetDrag, ...target }
          : state.assetDrag,
    })),
  cancelAssetDrag: () => set({ assetDrag: idleAssetDrag }),
  setClipboardElement: (clipboardElement) =>
    set({ clipboardElement: clipboardElement ? structuredClone(clipboardElement) : null }),
  incrementPasteCount: () => set((state) => ({ pasteCount: state.pasteCount + 1 })),
  recordHistory: (documents) =>
    set((state) => ({
      undoStack: pushHistorySnapshot(state.undoStack, documents),
      redoStack: [],
    })),
  undo: (current) => {
    const state = get();
    const previous = state.undoStack.at(-1);
    if (!previous) {
      return null;
    }

    set({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: pushHistorySnapshot(state.redoStack, current),
    });
    return cloneDocuments(previous);
  },
  redo: (current) => {
    const state = get();
    const next = state.redoStack.at(-1);
    if (!next) {
      return null;
    }

    set({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: pushHistorySnapshot(state.undoStack, current),
    });
    return cloneDocuments(next);
  },
  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,
  openContextMenu: (elementId, x, y) =>
    set({
      contextMenu: {
        open: true,
        elementId,
        x,
        y,
      },
    }),
  repositionContextMenu: (width, height) =>
    set((state) => ({
      contextMenu: {
        ...state.contextMenu,
        x: Math.max(8, Math.min(window.innerWidth - width - 8, state.contextMenu.x)),
        y: Math.max(8, Math.min(window.innerHeight - height - 8, state.contextMenu.y)),
      },
    })),
  closeContextMenu: () =>
    set({ contextMenu: { open: false, elementId: null, x: 0, y: 0 } }),
  toggleVisibilityPanel: () =>
    set((state) => ({ visibilityPanelOpen: !state.visibilityPanelOpen })),
  setVisibilityFilter: (key, value) =>
    set((state) => ({
      visibilityFilters: { ...state.visibilityFilters, [key]: value },
    })),
  setEditingTextElementId: (editingTextElementId) => set({ editingTextElementId }),
  setEditorZoom: (editorZoom) => set({ editorZoom: clampEditorZoom(editorZoom), zoomMode: "manual" }),
  setZoomMode: (zoomMode) => set({ zoomMode }),
  fitEditorZoom: () => set({ zoomMode: "fit" }),
  resetEditorZoom: () => set({ editorZoom: 1, zoomMode: "manual" }),
  openNotebook: (documentId) => {
    const current = get().notebookBook;
    const phase = current?.documentId === documentId ? current.phase : "closed";
    if (phase === "opening" || phase === "open" || phase === "closing") {
      return false;
    }

    set({
      notebookBook: { documentId, phase: "opening" },
      interaction: { mode: "idle", elementId: null, preview: null },
      transferPreview: null,
      drawingPreview: null,
      assetDrag: idleAssetDrag,
      contextMenu: { open: false, elementId: null, x: 0, y: 0 },
      editingTextElementId: null,
    });
    return true;
  },
  completeNotebookOpening: (documentId) =>
    set((state) => ({
      notebookBook:
        state.notebookBook?.documentId === documentId && state.notebookBook.phase === "opening"
          ? { documentId, phase: "open" }
          : state.notebookBook,
    })),
  closeNotebook: (documentId) => {
    const current = get().notebookBook;
    if (current?.documentId !== documentId || current.phase !== "open") {
      return false;
    }

    set({
      notebookBook: { documentId, phase: "closing" },
      notebookTransition: null,
      interaction: { mode: "idle", elementId: null, preview: null },
      transferPreview: null,
      drawingPreview: null,
      assetDrag: idleAssetDrag,
      contextMenu: { open: false, elementId: null, x: 0, y: 0 },
      editingTextElementId: null,
    });
    return true;
  },
  completeNotebookClosing: (documentId) =>
    set((state) => ({
      notebookBook:
        state.notebookBook?.documentId === documentId && state.notebookBook.phase === "closing"
          ? { documentId, phase: "closed" }
          : state.notebookBook,
    })),
  cancelNotebookBookTransition: (documentId) =>
    set((state) => ({
      notebookBook:
        state.notebookBook &&
        (!documentId || state.notebookBook.documentId === documentId) &&
        (state.notebookBook.phase === "opening" || state.notebookBook.phase === "closing")
          ? { documentId: state.notebookBook.documentId, phase: state.notebookBook.phase === "opening" ? "closed" : "open" }
          : state.notebookBook,
    })),
  beginNotebookTransition: (notebookTransition) => {
    if (get().notebookTransition) {
      return false;
    }

    set({
      notebookTransition,
      interaction: { mode: "idle", elementId: null, preview: null },
      transferPreview: null,
      drawingPreview: null,
      assetDrag: idleAssetDrag,
      contextMenu: { open: false, elementId: null, x: 0, y: 0 },
      editingTextElementId: null,
    });
    return true;
  },
  startNotebookTransition: (notebookTransition) => {
    const current = get().notebookTransition;
    if (
      !current ||
      current.documentId !== notebookTransition.documentId ||
      current.fromSurfaceId !== notebookTransition.fromSurfaceId ||
      current.toSurfaceId !== notebookTransition.toSurfaceId
    ) {
      return false;
    }

    set({ notebookTransition: { ...current, phase: "running" } });
    return true;
  },
  completeNotebookTransition: (notebookTransition) => {
    const current = get().notebookTransition;
    if (
      current &&
      current.documentId === notebookTransition.documentId &&
      current.fromSurfaceId === notebookTransition.fromSurfaceId &&
      current.toSurfaceId === notebookTransition.toSurfaceId
    ) {
      set({ notebookTransition: null });
    }
  },
  cancelNotebookTransition: (documentId) =>
    set((state) => ({
      notebookTransition:
        state.notebookTransition && (!documentId || state.notebookTransition.documentId === documentId)
          ? null
          : state.notebookTransition,
    })),
  setDrawingSettings: (settings) =>
    set((state) => ({ drawingSettings: { ...state.drawingSettings, ...settings } })),
  setRuler: (ruler) => set((state) => ({ ruler: { ...state.ruler, ...ruler } })),
  resetEditorSession: () =>
    set({
      editorMode: "select",
      activeToolPanel: null,
      interaction: { mode: "idle", elementId: null, preview: null },
      transferPreview: null,
      drawingPreview: null,
      assetDrag: idleAssetDrag,
      drawingSettings: defaultDrawingSettings,
      ruler: defaultRuler,
      clipboardElement: null,
      pasteCount: 0,
      undoStack: [],
      redoStack: [],
      contextMenu: { open: false, elementId: null, x: 0, y: 0 },
      visibilityPanelOpen: false,
      visibilityFilters: defaultVisibilityFilters,
      editingTextElementId: null,
      editorZoom: 1,
      zoomMode: "fit",
      notebookBook: null,
      notebookTransition: null,
    }),
}));

export function elementPassesVisibilityFilter(
  element: PageElement,
  filters: VisibilityFilters,
): boolean {
  if (element.hidden && !filters.hidden) {
    return false;
  }

  const keyByType: Partial<Record<PageElementType, keyof VisibilityFilters>> = {
    text: "text",
    image: "image",
    sticker: "sticker",
    tape: "tape",
    "post-it": "postIt",
    comment: "comment",
  };
  const key = keyByType[element.type];
  return key ? filters[key] : true;
}
