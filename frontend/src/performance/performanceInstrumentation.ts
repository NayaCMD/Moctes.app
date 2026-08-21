export type RenderMeasurementLabel = "opening" | "drag" | "resize";

export type ComponentRenderCounts = Record<string, number>;

interface ActiveRenderMeasurement {
  label: RenderMeasurementLabel;
  counts: ComponentRenderCounts;
}

let activeMeasurement: ActiveRenderMeasurement | null = null;

export function beginRenderMeasurement(label: RenderMeasurementLabel): void {
  activeMeasurement = { label, counts: {} };
}

export function recordComponentRender(componentName: string): void {
  if (!activeMeasurement) {
    return;
  }
  activeMeasurement.counts[componentName] =
    (activeMeasurement.counts[componentName] ?? 0) + 1;
}

export function endRenderMeasurement(
  expectedLabel: RenderMeasurementLabel,
): ComponentRenderCounts {
  if (!activeMeasurement || activeMeasurement.label !== expectedLabel) {
    return {};
  }
  const result = { ...activeMeasurement.counts };
  activeMeasurement = null;
  return result;
}

export function cancelRenderMeasurement(): void {
  activeMeasurement = null;
}
