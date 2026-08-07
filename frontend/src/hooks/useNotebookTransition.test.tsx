import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDocumentStore } from "../stores/useDocumentStore";
import { useEditorStore } from "../stores/useEditorStore";
import { resetStores } from "../test/helpers/resetStores";
import type { NotebookTransitionState } from "../types/notebook.types";
import { buildNotebookSurfaces } from "../utils/notebookSurfaces.utils";
import {
  NOTEBOOK_FLIP_DURATION_MS,
  NOTEBOOK_FLIP_FALLBACK_MARGIN_MS,
} from "../utils/notebookTransition.utils";
import { useNotebookTransition } from "./useNotebookTransition";

let rafCallbacks: FrameRequestCallback[] = [];

function activeNotebook() {
  const state = useDocumentStore.getState();
  const document = state.documents.find((item) => item.type === "notebook");

  if (!document) {
    throw new Error("Notebook document not found");
  }

  return document;
}

function installAnimationTimers() {
  vi.useFakeTimers();
  rafCallbacks = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    rafCallbacks.push(callback);
    return rafCallbacks.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    rafCallbacks[id - 1] = () => undefined;
  });
}

function installReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

function advanceTransitionToRunning() {
  act(() => {
    const callbacks = rafCallbacks;
    rafCallbacks = [];
    callbacks.forEach((callback) => callback(performance.now()));
  });
  act(() => {
    const callbacks = rafCallbacks;
    rafCallbacks = [];
    callbacks.forEach((callback) => callback(performance.now()));
  });
}

describe("useNotebookTransition", () => {
  beforeEach(() => {
    resetStores();
    useEditorStore.setState({
      notebookBook: { documentId: activeNotebook().id, phase: "open" },
    });
    installReducedMotion(false);
    installAnimationTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("cria transicao forward sem antecipar activeSurfaceId", () => {
    const notebook = activeNotebook();
    const surfaces = buildNotebookSurfaces(notebook);
    const fromSurface = surfaces[0];
    const toSurface = surfaces[1];
    useDocumentStore.getState().setActiveSurface(fromSurface.id, notebook.id);
    const { result } = renderHook(() => useNotebookTransition(activeNotebook()));

    act(() => {
      expect(result.current.navigateToSurface(toSurface.id)).toBe(true);
    });

    const transition = useEditorStore.getState().notebookTransition;
    expect(transition).toMatchObject({
      documentId: notebook.id,
      fromSurfaceId: fromSurface.id,
      toSurfaceId: toSurface.id,
      direction: "forward",
      phase: "preparing",
    });
    expect(activeNotebook().activeSurfaceId).toBe(fromSurface.id);

    advanceTransitionToRunning();
    expect(useEditorStore.getState().notebookTransition?.phase).toBe("running");
    expect(activeNotebook().activeSurfaceId).toBe(fromSurface.id);
  });

  it("determina backward e altera activeSurfaceId somente ao concluir", () => {
    const notebook = activeNotebook();
    const surfaces = buildNotebookSurfaces(notebook);
    useDocumentStore.getState().setActiveSurface(surfaces[1].id, notebook.id);

    const { result } = renderHook(() => useNotebookTransition(activeNotebook()));

    act(() => {
      expect(result.current.navigateToSurface(surfaces[0].id)).toBe(true);
    });

    const transition = useEditorStore.getState().notebookTransition;
    expect(transition?.direction).toBe("backward");
    expect(activeNotebook().activeSurfaceId).toBe(surfaces[1].id);

    act(() => {
      result.current.completeTransition(transition as NotebookTransitionState);
    });

    expect(activeNotebook().activeSurfaceId).toBe(surfaces[0].id);
    expect(useEditorStore.getState().notebookTransition).toBeNull();
  });

  it("ignora destino igual, destino invalido e nova solicitacao concorrente", () => {
    const notebook = activeNotebook();
    const surfaces = buildNotebookSurfaces(notebook);
    useDocumentStore.getState().setActiveSurface(surfaces[0].id, notebook.id);
    const { result } = renderHook(() => useNotebookTransition(activeNotebook()));

    act(() => {
      expect(result.current.navigateToSurface(surfaces[0].id)).toBe(false);
      expect(result.current.navigateToSurface("missing-surface")).toBe(false);
      expect(result.current.navigateToSurface(surfaces[1].id)).toBe(true);
      expect(result.current.navigateToSurface(surfaces[2].id)).toBe(false);
    });

    expect(useEditorStore.getState().notebookTransition?.toSurfaceId).toBe(surfaces[1].id);
  });

  it("fallback de tempo conclui a transicao uma unica vez", () => {
    const notebook = activeNotebook();
    const surfaces = buildNotebookSurfaces(notebook);
    const target = surfaces[1];
    useDocumentStore.getState().setActiveSurface(surfaces[0].id, notebook.id);
    const { result } = renderHook(() => useNotebookTransition(activeNotebook()));

    act(() => {
      expect(result.current.navigateToSurface(target.id)).toBe(true);
    });
    advanceTransitionToRunning();
    act(() => {
      vi.advanceTimersByTime(NOTEBOOK_FLIP_DURATION_MS + NOTEBOOK_FLIP_FALLBACK_MARGIN_MS);
    });

    expect(activeNotebook().activeSurfaceId).toBe(target.id);
    expect(useEditorStore.getState().notebookTransition).toBeNull();

    const undoCount = useEditorStore.getState().undoStack.length;
    act(() => {
      vi.advanceTimersByTime(NOTEBOOK_FLIP_DURATION_MS + NOTEBOOK_FLIP_FALLBACK_MARGIN_MS);
    });
    expect(useEditorStore.getState().undoStack).toHaveLength(undoCount);
  });

  it("cancelamento mantem a origem", () => {
    const notebook = activeNotebook();
    const surfaces = buildNotebookSurfaces(notebook);
    useDocumentStore.getState().setActiveSurface(surfaces[0].id, notebook.id);
    const { result } = renderHook(() => useNotebookTransition(activeNotebook()));

    act(() => {
      expect(result.current.navigateToSurface(surfaces[1].id)).toBe(true);
      result.current.cancelTransition();
    });

    expect(activeNotebook().activeSurfaceId).toBe(surfaces[0].id);
    expect(useEditorStore.getState().notebookTransition).toBeNull();
  });

  it("cancelamento depois da fase running limpa fallback antigo sem mudar superficie", () => {
    const notebook = activeNotebook();
    const surfaces = buildNotebookSurfaces(notebook);
    useDocumentStore.getState().setActiveSurface(surfaces[0].id, notebook.id);
    const { result } = renderHook(() => useNotebookTransition(activeNotebook()));

    act(() => {
      expect(result.current.navigateToSurface(surfaces[1].id)).toBe(true);
    });
    advanceTransitionToRunning();
    act(() => {
      result.current.cancelTransition();
      vi.advanceTimersByTime(NOTEBOOK_FLIP_DURATION_MS + NOTEBOOK_FLIP_FALLBACK_MARGIN_MS);
    });

    expect(activeNotebook().activeSurfaceId).toBe(surfaces[0].id);
    expect(useEditorStore.getState().notebookTransition).toBeNull();
  });

  it("desmontagem limpa transicao, timers e requestAnimationFrame", () => {
    const notebook = activeNotebook();
    const surfaces = buildNotebookSurfaces(notebook);
    useDocumentStore.getState().setActiveSurface(surfaces[0].id, notebook.id);
    const { result, unmount } = renderHook(() => useNotebookTransition(activeNotebook()));

    act(() => {
      expect(result.current.navigateToSurface(surfaces[1].id)).toBe(true);
    });
    advanceTransitionToRunning();
    act(() => {
      unmount();
      vi.advanceTimersByTime(NOTEBOOK_FLIP_DURATION_MS + NOTEBOOK_FLIP_FALLBACK_MARGIN_MS);
    });

    expect(activeNotebook().activeSurfaceId).toBe(surfaces[0].id);
    expect(useEditorStore.getState().notebookTransition).toBeNull();
  });

  it("movimento reduzido navega imediatamente sem folha 3D", () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    installReducedMotion(true);

    const notebook = activeNotebook();
    const surfaces = buildNotebookSurfaces(notebook);
    const target = surfaces[1];
    useDocumentStore.getState().setActiveSurface(surfaces[0].id, notebook.id);
    const { result } = renderHook(() => useNotebookTransition(activeNotebook()));

    act(() => {
      expect(result.current.navigateToSurface(target.id)).toBe(true);
    });

    expect(activeNotebook().activeSurfaceId).toBe(target.id);
    expect(useEditorStore.getState().notebookTransition).toBeNull();
  });
});
