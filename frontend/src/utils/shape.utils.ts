import type { ShapeAppearance } from "../types/element.types";

export const DEFAULT_SHAPE_APPEARANCE: ShapeAppearance = {
  shapeType: "rectangle",
  fillColor: "#dfe8ff",
  strokeColor: "#8da3ed",
  strokeWidth: 2,
  opacity: 1,
  preserveAspectRatio: false,
};

export function createShapeAppearance(
  shapeType: ShapeAppearance["shapeType"],
  overrides: Partial<ShapeAppearance> = {},
): ShapeAppearance {
  return {
    ...DEFAULT_SHAPE_APPEARANCE,
    shapeType,
    preserveAspectRatio: shapeType === "circle" || shapeType === "star" || shapeType === "heart",
    ...overrides,
  };
}

export function normalizeShapeAppearance(input: unknown): ShapeAppearance {
  if (typeof input !== "object" || input === null) {
    return DEFAULT_SHAPE_APPEARANCE;
  }
  const value = input as Partial<ShapeAppearance>;
  return {
    ...DEFAULT_SHAPE_APPEARANCE,
    ...value,
    shapeType: value.shapeType ?? DEFAULT_SHAPE_APPEARANCE.shapeType,
    fillColor: value.fillColor ?? DEFAULT_SHAPE_APPEARANCE.fillColor,
    strokeColor: value.strokeColor ?? DEFAULT_SHAPE_APPEARANCE.strokeColor,
    strokeWidth: Number.isFinite(value.strokeWidth) ? Number(value.strokeWidth) : DEFAULT_SHAPE_APPEARANCE.strokeWidth,
    opacity: Number.isFinite(value.opacity)
      ? Math.min(1, Math.max(0, Number(value.opacity)))
      : DEFAULT_SHAPE_APPEARANCE.opacity,
    preserveAspectRatio: Boolean(value.preserveAspectRatio),
  };
}
