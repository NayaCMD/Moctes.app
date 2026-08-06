import { useCallback, useEffect, useRef } from "react";
import type { MoctesDocument } from "../types/document.types";
import type { NotebookTransitionState } from "../types/notebook.types";
import { useDocumentStore } from "../stores/useDocumentStore";
import { useEditorStore } from "../stores/useEditorStore";
import { buildNotebookSurfaces } from "../utils/notebookSurfaces.utils";
import {
  getNotebookTransitionDirection,
  getSurfaceOffsetTarget,
  NOTEBOOK_FLIP_DURATION_MS,
  NOTEBOOK_FLIP_FALLBACK_MARGIN_MS,
} from "../utils/notebookTransition.utils";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

interface NotebookTransitionControls {
  transition: NotebookTransitionState | null;
  isTransitioning: boolean;
  navigateToSurface: (targetSurfaceId: string) => boolean;
  navigateNext: () => boolean;
  navigatePrevious: () => boolean;
  navigateToSection: (sectionId: string) => boolean;
  navigateToPage: (pageId: string) => boolean;
  completeTransition: (transition: NotebookTransitionState) => void;
  cancelTransition: () => void;
}

function transitionMatches(
  first: NotebookTransitionState | null,
  second: NotebookTransitionState,
): boolean {
  return Boolean(
    first &&
      first.documentId === second.documentId &&
      first.fromSurfaceId === second.fromSurfaceId &&
      first.toSurfaceId === second.toSurfaceId,
  );
}

export function useNotebookTransition(document: MoctesDocument): NotebookTransitionControls {
  const setActiveSurface = useDocumentStore((state) => state.setActiveSurface);
  const notebookTransition = useEditorStore((state) => state.notebookTransition);
  const beginNotebookTransition = useEditorStore((state) => state.beginNotebookTransition);
  const startNotebookTransition = useEditorStore((state) => state.startNotebookTransition);
  const completeNotebookTransition = useEditorStore((state) => state.completeNotebookTransition);
  const cancelNotebookTransition = useEditorStore((state) => state.cancelNotebookTransition);
  const setEditingTextElementId = useEditorStore((state) => state.setEditingTextElementId);
  const closeContextMenu = useEditorStore((state) => state.closeContextMenu);
  const cancelAssetDrag = useEditorStore((state) => state.cancelAssetDrag);
  const endInteraction = useEditorStore((state) => state.endInteraction);
  const prefersReducedMotion = usePrefersReducedMotion();
  const rafIds = useRef<number[]>([]);
  const fallbackTimer = useRef<number | null>(null);
  const activeTransition = notebookTransition?.documentId === document.id ? notebookTransition : null;

  const clearAsyncGuards = useCallback(() => {
    for (const rafId of rafIds.current) {
      window.cancelAnimationFrame(rafId);
    }
    rafIds.current = [];

    if (fallbackTimer.current !== null) {
      window.clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
  }, []);

  const completeTransition = useCallback(
    (transition: NotebookTransitionState) => {
      const current = useEditorStore.getState().notebookTransition;
      if (!transitionMatches(current, transition)) {
        return;
      }

      clearAsyncGuards();
      setActiveSurface(transition.toSurfaceId, transition.documentId);
      completeNotebookTransition(transition);
    },
    [clearAsyncGuards, completeNotebookTransition, setActiveSurface],
  );

  const navigateToSurface = useCallback(
    (targetSurfaceId: string) => {
      if (useEditorStore.getState().notebookTransition) {
        return false;
      }

      const surfaces = buildNotebookSurfaces(document);
      const fromSurface =
        surfaces.find((surface) => surface.id === document.activeSurfaceId) ?? surfaces[0];
      const toSurface = surfaces.find((surface) => surface.id === targetSurfaceId);
      if (!fromSurface || !toSurface) {
        return false;
      }

      const direction = getNotebookTransitionDirection(surfaces, fromSurface.id, toSurface.id);
      if (!direction) {
        return false;
      }

      if (prefersReducedMotion) {
        return setActiveSurface(toSurface.id, document.id);
      }

      const transition: NotebookTransitionState = {
        documentId: document.id,
        fromSurfaceId: fromSurface.id,
        toSurfaceId: toSurface.id,
        direction,
        phase: "preparing",
      };

      setEditingTextElementId(null);
      closeContextMenu();
      cancelAssetDrag();
      endInteraction();
      if (globalThis.document.activeElement instanceof HTMLElement) {
        globalThis.document.activeElement.blur();
      }

      if (!beginNotebookTransition(transition)) {
        return false;
      }

      const firstFrame = window.requestAnimationFrame(() => {
        const secondFrame = window.requestAnimationFrame(() => {
          startNotebookTransition({ ...transition, phase: "running" });
          fallbackTimer.current = window.setTimeout(
            () => completeTransition(transition),
            NOTEBOOK_FLIP_DURATION_MS + NOTEBOOK_FLIP_FALLBACK_MARGIN_MS,
          );
        });
        rafIds.current.push(secondFrame);
      });
      rafIds.current.push(firstFrame);
      return true;
    },
    [
      beginNotebookTransition,
      cancelAssetDrag,
      closeContextMenu,
      completeTransition,
      document,
      endInteraction,
      prefersReducedMotion,
      setActiveSurface,
      setEditingTextElementId,
      startNotebookTransition,
    ],
  );

  const navigateNext = useCallback(() => {
    const surfaces = buildNotebookSurfaces(document);
    const target = getSurfaceOffsetTarget(surfaces, document.activeSurfaceId, 1);
    return target ? navigateToSurface(target.id) : false;
  }, [document, navigateToSurface]);

  const navigatePrevious = useCallback(() => {
    const surfaces = buildNotebookSurfaces(document);
    const target = getSurfaceOffsetTarget(surfaces, document.activeSurfaceId, -1);
    return target ? navigateToSurface(target.id) : false;
  }, [document, navigateToSurface]);

  const navigateToSection = useCallback(
    (sectionId: string) => {
      const section = document.sections?.find((item) => item.id === sectionId);
      return section ? navigateToSurface(section.divider.id) : false;
    },
    [document.sections, navigateToSurface],
  );

  const navigateToPage = useCallback(
    (pageId: string) => navigateToSurface(pageId),
    [navigateToSurface],
  );

  const cancelTransition = useCallback(() => {
    clearAsyncGuards();
    cancelNotebookTransition(document.id);
  }, [cancelNotebookTransition, clearAsyncGuards, document.id]);

  useEffect(() => cancelTransition, [cancelTransition]);

  return {
    transition: activeTransition,
    isTransitioning: Boolean(activeTransition),
    navigateToSurface,
    navigateNext,
    navigatePrevious,
    navigateToSection,
    navigateToPage,
    completeTransition,
    cancelTransition,
  };
}
