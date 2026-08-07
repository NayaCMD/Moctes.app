import { useCallback, useEffect, useRef } from "react";
import type { MoctesDocument } from "../types/document.types";
import type { NotebookBookState } from "../types/notebook.types";
import { useEditorStore } from "../stores/useEditorStore";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export const NOTEBOOK_OPEN_DURATION_MS = 620;
const NOTEBOOK_OPEN_FALLBACK_MARGIN_MS = 120;

interface NotebookBookControls {
  state: NotebookBookState;
  isClosed: boolean;
  isOpen: boolean;
  isBusy: boolean;
  open: () => boolean;
  close: () => boolean;
  completeOpening: () => void;
  completeClosing: () => void;
  cancel: () => void;
}

function getPhase(documentId: string): NotebookBookState {
  const state = useEditorStore.getState().notebookBook;
  return state?.documentId === documentId ? state : { documentId, phase: "closed" };
}

export function useNotebookBook(document: MoctesDocument): NotebookBookControls {
  const notebookBook = useEditorStore((state) => state.notebookBook);
  const openNotebook = useEditorStore((state) => state.openNotebook);
  const completeNotebookOpening = useEditorStore((state) => state.completeNotebookOpening);
  const closeNotebook = useEditorStore((state) => state.closeNotebook);
  const completeNotebookClosing = useEditorStore((state) => state.completeNotebookClosing);
  const cancelNotebookBookTransition = useEditorStore((state) => state.cancelNotebookBookTransition);
  const prefersReducedMotion = usePrefersReducedMotion();
  const fallbackTimer = useRef<number | null>(null);

  const state = notebookBook?.documentId === document.id ? notebookBook : { documentId: document.id, phase: "closed" as const };

  const clearTimer = useCallback(() => {
    if (fallbackTimer.current !== null) {
      window.clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
  }, []);

  const completeOpening = useCallback(() => {
    clearTimer();
    completeNotebookOpening(document.id);
  }, [clearTimer, completeNotebookOpening, document.id]);

  const completeClosing = useCallback(() => {
    clearTimer();
    completeNotebookClosing(document.id);
  }, [clearTimer, completeNotebookClosing, document.id]);

  const open = useCallback(() => {
    if (prefersReducedMotion) {
      if (!openNotebook(document.id)) {
        return false;
      }
      completeNotebookOpening(document.id);
      return true;
    }

    if (!openNotebook(document.id)) {
      return false;
    }

    clearTimer();
    fallbackTimer.current = window.setTimeout(
      () => completeNotebookOpening(document.id),
      NOTEBOOK_OPEN_DURATION_MS + NOTEBOOK_OPEN_FALLBACK_MARGIN_MS,
    );
    return true;
  }, [clearTimer, completeNotebookOpening, document.id, openNotebook, prefersReducedMotion]);

  const close = useCallback(() => {
    if (prefersReducedMotion) {
      if (!closeNotebook(document.id)) {
        return false;
      }
      completeNotebookClosing(document.id);
      return true;
    }

    if (!closeNotebook(document.id)) {
      return false;
    }

    clearTimer();
    fallbackTimer.current = window.setTimeout(
      () => completeNotebookClosing(document.id),
      NOTEBOOK_OPEN_DURATION_MS + NOTEBOOK_OPEN_FALLBACK_MARGIN_MS,
    );
    return true;
  }, [clearTimer, closeNotebook, completeNotebookClosing, document.id, prefersReducedMotion]);

  const cancel = useCallback(() => {
    clearTimer();
    cancelNotebookBookTransition(document.id);
  }, [cancelNotebookBookTransition, clearTimer, document.id]);

  useEffect(() => cancel, [cancel]);

  return {
    state,
    isClosed: getPhase(document.id).phase === "closed",
    isOpen: state.phase === "open",
    isBusy: state.phase === "opening" || state.phase === "closing",
    open,
    close,
    completeOpening,
    completeClosing,
    cancel,
  };
}
