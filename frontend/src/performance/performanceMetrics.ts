export interface FrameRateMetrics {
  durationMs: number;
  frameCount: number;
  averageFps: number;
  medianFrameMs: number;
  p95FrameMs: number;
  longestFrameMs: number;
  droppedFrameRatio: number;
}

export interface HeapSnapshot {
  supported: boolean;
  usedBytes: number | null;
  totalBytes: number | null;
  limitBytes: number | null;
}

interface ChromiumMemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export function measureSerializedBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function readHeapSnapshot(): HeapSnapshot {
  const memory = (
    performance as Performance & { memory?: ChromiumMemoryInfo }
  ).memory;
  if (!memory) {
    return {
      supported: false,
      usedBytes: null,
      totalBytes: null,
      limitBytes: null,
    };
  }
  return {
    supported: true,
    usedBytes: memory.usedJSHeapSize,
    totalBytes: memory.totalJSHeapSize,
    limitBytes: memory.jsHeapSizeLimit,
  };
}

export async function measureFrameRate(options: {
  durationMs: number;
  onFrame?: (progress: number) => void;
}): Promise<FrameRateMetrics> {
  const { durationMs, onFrame } = options;
  const frameTimes: number[] = [];
  const startedAt = performance.now();
  let previousFrameAt = startedAt;

  await new Promise<void>((resolve) => {
    const measure = (now: number) => {
      const elapsed = now - startedAt;
      if (now > previousFrameAt) {
        frameTimes.push(now - previousFrameAt);
      }
      previousFrameAt = now;
      onFrame?.(Math.min(1, elapsed / durationMs));
      if (elapsed >= durationMs) {
        resolve();
        return;
      }
      requestAnimationFrame(measure);
    };
    requestAnimationFrame(measure);
  });

  const actualDuration = performance.now() - startedAt;
  const sorted = [...frameTimes].sort((first, second) => first - second);
  const droppedFrames = frameTimes.filter((frameMs) => frameMs > 25).length;
  return {
    durationMs: round(actualDuration),
    frameCount: frameTimes.length,
    averageFps: round((frameTimes.length / actualDuration) * 1_000),
    medianFrameMs: round(percentile(sorted, 0.5)),
    p95FrameMs: round(percentile(sorted, 0.95)),
    longestFrameMs: round(sorted.at(-1) ?? 0),
    droppedFrameRatio: round(
      frameTimes.length > 0 ? droppedFrames / frameTimes.length : 0,
      4,
    ),
  };
}

export async function waitForPaint(frameCount = 2): Promise<void> {
  for (let index = 0; index < frameCount; index += 1) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

export async function waitForCondition(
  predicate: () => boolean,
  timeoutMs = 15_000,
): Promise<void> {
  const startedAt = performance.now();
  while (!predicate()) {
    if (performance.now() - startedAt > timeoutMs) {
      throw new Error("O laboratorio excedeu o tempo de espera pela renderizacao.");
    }
    await waitForPaint(1);
  }
}

export function round(value: number, decimalPlaces = 2): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

function percentile(sortedValues: number[], fraction: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * fraction) - 1),
  );
  return sortedValues[index];
}
