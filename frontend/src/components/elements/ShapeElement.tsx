import type { PageElement, ShapeAppearance } from "../../types/element.types";

interface ShapeElementProps {
  element: PageElement;
}

export function ShapeElement({ element }: ShapeElementProps) {
  if (element.content.kind !== "shape") {
    return null;
  }

  const appearance = element.content.appearance;
  const common = {
    fill: getFill(appearance),
    stroke: appearance.strokeColor,
    strokeWidth: appearance.strokeWidth,
    opacity: appearance.opacity,
    vectorEffect: "non-scaling-stroke" as const,
  };

  return (
    <span className="page-shape-element" data-shape={appearance.shapeType}>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio={appearance.preserveAspectRatio ? "xMidYMid meet" : "none"}
      >
        {renderShape(appearance, common)}
      </svg>
      {element.content.label && (
        <span className="page-shape-label" style={element.style.text}>
          {element.content.label}
        </span>
      )}
    </span>
  );
}

function getFill(appearance: ShapeAppearance): string {
  return appearance.shapeType === "line" || appearance.shapeType === "arrow"
    ? "none"
    : appearance.fillColor;
}

function renderShape(
  appearance: ShapeAppearance,
  common: {
    fill: string;
    stroke: string;
    strokeWidth: number;
    opacity: number;
    vectorEffect: "non-scaling-stroke";
  },
) {
  switch (appearance.shapeType) {
    case "circle":
      return <ellipse cx="50" cy="50" rx="42" ry="42" {...common} />;
    case "rounded-rectangle":
      return <rect x="8" y="10" width="84" height="80" rx="18" {...common} />;
    case "triangle":
      return <polygon points="50,8 92,90 8,90" {...common} />;
    case "line":
      return (
        <line
          x1="8"
          y1="50"
          x2="92"
          y2="50"
          stroke={appearance.strokeColor}
          strokeWidth={Math.max(2, appearance.strokeWidth)}
          strokeLinecap="round"
          opacity={appearance.opacity}
          vectorEffect="non-scaling-stroke"
        />
      );
    case "arrow":
      return (
        <g
          fill="none"
          stroke={appearance.strokeColor}
          strokeWidth={Math.max(2, appearance.strokeWidth)}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={appearance.opacity}
          vectorEffect="non-scaling-stroke"
        >
          <path d="M10 50H84" />
          <path d="M68 32L86 50L68 68" />
        </g>
      );
    case "star":
      return (
        <polygon
          points="50,8 61,37 92,38 68,57 76,88 50,70 24,88 32,57 8,38 39,37"
          {...common}
        />
      );
    case "heart":
      return (
        <path
          d="M50 86C25 66 12 52 12 34C12 21 22 12 34 12C42 12 48 16 50 23C52 16 58 12 66 12C78 12 88 21 88 34C88 52 75 66 50 86Z"
          {...common}
        />
      );
    case "custom-svg":
      return <rect x="8" y="10" width="84" height="80" rx="12" {...common} />;
    case "rectangle":
    default:
      return <rect x="8" y="10" width="84" height="80" rx="4" {...common} />;
  }
}
