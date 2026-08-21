import { useCallback, useEffect, useState } from "react";
import { DocumentPage } from "../components/documents/DocumentPage";
import { useAppStore } from "../stores/useAppStore";
import { useDocumentStore } from "../stores/useDocumentStore";
import { useEditorStore } from "../stores/useEditorStore";
import {
  beginRenderMeasurement,
  cancelRenderMeasurement,
  endRenderMeasurement,
  type ComponentRenderCounts,
} from "./performanceInstrumentation";
import {
  measureFrameRate,
  measureSerializedBytes,
  readHeapSnapshot,
  round,
  waitForCondition,
  waitForPaint,
  type FrameRateMetrics,
  type HeapSnapshot,
} from "./performanceMetrics";
import {
  createScaleScenario,
  SCALE_PROFILES,
  type ScaleProfileName,
  type ScaleScenarioSummary,
} from "./scaleScenarios";
import {
  runConflictScaleBenchmark,
  runSyncScaleBenchmark,
  type ConflictScaleMetrics,
  type SyncScaleMetrics,
} from "./syncScaleBenchmark";
import "./performanceLab.css";

interface ZustandSizeMetrics {
  documentStoreBytes: number;
  editorStoreBytes: number;
  appStoreBytes: number;
  totalBytes: number;
}

interface HeapMetrics {
  before: HeapSnapshot;
  afterOpen: HeapSnapshot;
  afterRun: HeapSnapshot;
  usedHeapDeltaBytes: number | null;
}

export interface PerformanceLabReport {
  schemaVersion: 1;
  runId: string;
  generatedAt: string;
  profile: ScaleProfileName;
  environment: {
    userAgent: string;
    viewport: { width: number; height: number; devicePixelRatio: number };
    strictMode: false;
  };
  scenario: ScaleScenarioSummary;
  timings: {
    scenarioGenerationMs: number;
    documentOpenMs: number;
  };
  fps: {
    drag: FrameRateMetrics;
    resize: FrameRateMetrics;
  };
  heap: HeapMetrics;
  zustand: ZustandSizeMetrics;
  renders: {
    opening: ComponentRenderCounts;
    drag: ComponentRenderCounts;
    resize: ComponentRenderCounts;
  };
  sync: SyncScaleMetrics;
  conflicts: ConflictScaleMetrics;
}

interface PerformanceLabBridge {
  run: (profile?: ScaleProfileName) => Promise<PerformanceLabReport>;
  latestReport: PerformanceLabReport | null;
}

declare global {
  interface Window {
    __MOCTES_PERFORMANCE__?: PerformanceLabBridge;
  }
}

const DRAG_DURATION_MS = 1_500;
const RESIZE_DURATION_MS = 1_500;

export function PerformanceLab() {
  const [profile, setProfile] = useState<ScaleProfileName>("large");
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Pronto para executar.");
  const [report, setReport] = useState<PerformanceLabReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeDocument = useDocumentStore((state) =>
    state.documents.find(
      (document) => document.id === state.activeDocumentId,
    ),
  );
  const activePage = activeDocument?.pages.find(
    (page) => page.id === activeDocument.activePageId,
  );

  const run = useCallback(
    async (requestedProfile: ScaleProfileName = profile) => {
      setRunning(true);
      setError(null);
      setReport(null);
      cancelRenderMeasurement();
      const runId = createRunId();
      const heapBefore = readHeapSnapshot();

      try {
        setStatus("Gerando documento deterministico...");
        await waitForPaint(1);
        const generationStartedAt = performance.now();
        const scenario = createScaleScenario(requestedProfile);
        const scenarioGenerationMs = performance.now() - generationStartedAt;

        useEditorStore.getState().resetEditorSession();
        useEditorStore.getState().setEditorMode("select");
        useAppStore.getState().setActiveTool("preview");

        setStatus("Abrindo documento e aguardando o primeiro paint...");
        beginRenderMeasurement("opening");
        const openingStartedAt = performance.now();
        useDocumentStore
          .getState()
          .applyDocumentsSnapshot([scenario.document]);
        await waitForCondition(
          () =>
            globalThis.document.querySelectorAll(
              `[data-page-id="${scenario.document.activePageId}"] [data-element-id]`,
            ).length === scenario.summary.activePageElements,
        );
        await waitForImages();
        await waitForPaint(2);
        const documentOpenMs = performance.now() - openingStartedAt;
        const openingRenders = endRenderMeasurement("opening");
        const heapAfterOpen = readHeapSnapshot();

        const targetElementId = scenario.document.pages[0].elements[0].id;
        useDocumentStore.getState().selectElement(targetElementId);
        await waitForCondition(
          () =>
            globalThis.document.querySelector(
              `.selection-box [data-handle="bottom-right"]`,
            ) !== null,
        );
        await waitForPaint(2);

        setStatus("Medindo FPS e renders durante drag...");
        const dragResult = await runPointerBenchmark({
          kind: "drag",
          elementId: targetElementId,
          durationMs: DRAG_DURATION_MS,
        });

        setStatus("Medindo FPS e renders durante resize...");
        const resizeResult = await runPointerBenchmark({
          kind: "resize",
          elementId: targetElementId,
          durationMs: RESIZE_DURATION_MS,
        });

        setStatus("Medindo fila IndexedDB e sincronizacao...");
        const sync = await runSyncScaleBenchmark({
          queueDocuments: scenario.queueDocuments,
          runId,
        });

        setStatus("Executando conflitos recorrentes...");
        const conflicts = runConflictScaleBenchmark(
          scenario.config.conflictCycles,
        );
        const heapAfterRun = readHeapSnapshot();
        const zustand = readZustandSizes();
        const result: PerformanceLabReport = {
          schemaVersion: 1,
          runId,
          generatedAt: new Date().toISOString(),
          profile: requestedProfile,
          environment: {
            userAgent: navigator.userAgent,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
              devicePixelRatio: window.devicePixelRatio,
            },
            strictMode: false,
          },
          scenario: scenario.summary,
          timings: {
            scenarioGenerationMs: round(scenarioGenerationMs),
            documentOpenMs: round(documentOpenMs),
          },
          fps: {
            drag: dragResult.frames,
            resize: resizeResult.frames,
          },
          heap: {
            before: heapBefore,
            afterOpen: heapAfterOpen,
            afterRun: heapAfterRun,
            usedHeapDeltaBytes: heapDelta(heapBefore, heapAfterRun),
          },
          zustand,
          renders: {
            opening: openingRenders,
            drag: dragResult.renders,
            resize: resizeResult.renders,
          },
          sync,
          conflicts,
        };
        setReport(result);
        if (window.__MOCTES_PERFORMANCE__) {
          window.__MOCTES_PERFORMANCE__.latestReport = result;
        }
        setStatus("Medicao concluida.");
        return result;
      } catch (caughtError) {
        cancelRenderMeasurement();
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Falha inesperada no laboratorio.";
        setError(message);
        setStatus("Medicao interrompida.");
        throw caughtError;
      } finally {
        setRunning(false);
      }
    },
    [profile],
  );

  useEffect(() => {
    window.__MOCTES_PERFORMANCE__ = {
      run,
      latestReport: report,
    };
    return () => {
      delete window.__MOCTES_PERFORMANCE__;
    };
  }, [report, run]);

  return (
    <main className="performance-lab">
      <header className="performance-lab-header">
        <div>
          <span className="performance-lab-kicker">Moctes engineering</span>
          <h1>Laboratorio de escala</h1>
          <p>
            Baseline reproduzivel do renderer e da sincronizacao atuais. Esta
            rota usa memoria para o store de documentos e nao altera os dados
            locais do usuario.
          </p>
        </div>
        <div className="performance-lab-controls">
          <label>
            Cenario
            <select
              value={profile}
              disabled={running}
              onChange={(event) =>
                setProfile(event.target.value as ScaleProfileName)
              }
            >
              {Object.keys(SCALE_PROFILES).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={running}
            data-testid="run-performance-lab"
            onClick={() => void run(profile)}
          >
            {running ? "Executando..." : "Executar medicao"}
          </button>
          {report && (
            <button type="button" onClick={() => downloadReport(report)}>
              Baixar JSON
            </button>
          )}
        </div>
      </header>

      <section className="performance-lab-status" aria-live="polite">
        <strong>Status:</strong> <span data-testid="performance-status">{status}</span>
        {error && <p role="alert">{error}</p>}
      </section>

      {report && <ReportSummary report={report} />}

      <section className="performance-lab-stage" aria-label="Documento do benchmark">
        {activePage ? (
          <DocumentPage
            page={activePage}
            className="performance-paper"
            label="Pagina ativa do laboratorio de performance"
          />
        ) : (
          <p>O documento de teste aparecera aqui.</p>
        )}
      </section>

      {report && (
        <details className="performance-lab-json">
          <summary>Relatorio completo</summary>
          <pre data-testid="performance-report">
            {JSON.stringify(report, null, 2)}
          </pre>
        </details>
      )}
    </main>
  );
}

function ReportSummary({ report }: { report: PerformanceLabReport }) {
  return (
    <section className="performance-lab-summary" aria-label="Resumo das metricas">
      <Metric label="Paginas" value={report.scenario.pages.toLocaleString("pt-BR")} />
      <Metric label="Elementos" value={report.scenario.elements.toLocaleString("pt-BR")} />
      <Metric label="Imagens" value={report.scenario.imageElements.toLocaleString("pt-BR")} />
      <Metric label="Abertura" value={`${report.timings.documentOpenMs} ms`} />
      <Metric label="Drag" value={`${report.fps.drag.averageFps} FPS`} />
      <Metric label="Resize" value={`${report.fps.resize.averageFps} FPS`} />
      <Metric label="Estado Zustand" value={formatBytes(report.zustand.totalBytes)} />
      <Metric
        label="Heap (delta)"
        value={
          report.heap.usedHeapDeltaBytes === null
            ? "indisponivel"
            : formatBytes(report.heap.usedHeapDeltaBytes)
        }
      />
      <Metric label="Fila offline" value={`${report.sync.operationCount} ops`} />
      <Metric label="Sincronizacao" value={`${report.sync.drainMs} ms`} />
      <Metric label="Conflitos" value={`${report.conflicts.cycles} ciclos`} />
      <Metric
        label="Renders no drag"
        value={`${report.renders.drag.PageElementRenderer ?? 0}`}
      />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

async function runPointerBenchmark(options: {
  kind: "drag" | "resize";
  elementId: string;
  durationMs: number;
}): Promise<{ frames: FrameRateMetrics; renders: ComponentRenderCounts }> {
  const { kind, elementId, durationMs } = options;
  const target = getPointerTarget(kind, elementId);
  const rect = target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    throw new Error(`O alvo de ${kind} nao possui dimensoes renderizadas.`);
  }
  const startX = rect.left + rect.width / 2;
  const startY = rect.top + rect.height / 2;
  const pointerId = kind === "drag" ? 41 : 42;
  const label = kind === "drag" ? "drag" : "resize";
  beginRenderMeasurement(label);
  dispatchPointer(target, "pointerdown", {
    clientX: startX,
    clientY: startY,
    pointerId,
    buttons: 1,
  });

  const frames = await measureFrameRate({
    durationMs,
    onFrame: (progress) => {
      const distanceX = kind === "drag" ? 120 : 85;
      const distanceY = kind === "drag" ? 48 : 65;
      dispatchPointer(window, "pointermove", {
        clientX: startX + distanceX * progress,
        clientY: startY + distanceY * progress,
        pointerId,
        buttons: 1,
      });
    },
  });
  dispatchPointer(window, "pointerup", {
    clientX: startX + (kind === "drag" ? 120 : 85),
    clientY: startY + (kind === "drag" ? 48 : 65),
    pointerId,
    buttons: 0,
  });
  await waitForPaint(2);
  return {
    frames,
    renders: endRenderMeasurement(label),
  };
}

function getPointerTarget(
  kind: "drag" | "resize",
  elementId: string,
): HTMLElement {
  const selector =
    kind === "drag"
      ? `[data-element-id="${elementId}"]`
      : `.selection-box [data-handle="bottom-right"]`;
  const target = globalThis.document.querySelector<HTMLElement>(selector);
  if (!target) {
    throw new Error(`Nao foi possivel localizar o alvo de ${kind}.`);
  }
  return target;
}

function dispatchPointer(
  target: EventTarget,
  type: "pointerdown" | "pointermove" | "pointerup",
  init: {
    clientX: number;
    clientY: number;
    pointerId: number;
    buttons: number;
  },
): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerType: "mouse",
      isPrimary: true,
      button: type === "pointerup" ? 0 : 0,
      ...init,
    }),
  );
}

async function waitForImages(): Promise<void> {
  const images = [
    ...globalThis.document.querySelectorAll<HTMLImageElement>(
      ".performance-lab-stage img",
    ),
  ];
  await Promise.allSettled(
    images.map((image) =>
      typeof image.decode === "function" ? image.decode() : Promise.resolve(),
    ),
  );
}

function readZustandSizes(): ZustandSizeMetrics {
  const documentStoreBytes = measureSerializedBytes(
    useDocumentStore.getState(),
  );
  const editorStoreBytes = measureSerializedBytes(useEditorStore.getState());
  const appStoreBytes = measureSerializedBytes(useAppStore.getState());
  return {
    documentStoreBytes,
    editorStoreBytes,
    appStoreBytes,
    totalBytes: documentStoreBytes + editorStoreBytes + appStoreBytes,
  };
}

function heapDelta(before: HeapSnapshot, after: HeapSnapshot): number | null {
  if (before.usedBytes === null || after.usedBytes === null) {
    return null;
  }
  return after.usedBytes - before.usedBytes;
}

function createRunId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function downloadReport(report: PerformanceLabReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement("a");
  anchor.href = url;
  anchor.download = `moctes-performance-${report.profile}-${report.runId}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes: number): string {
  const absoluteBytes = Math.abs(bytes);
  if (absoluteBytes < 1_024) {
    return `${bytes} B`;
  }
  if (absoluteBytes < 1_048_576) {
    return `${round(bytes / 1_024)} KiB`;
  }
  return `${round(bytes / 1_048_576)} MiB`;
}
