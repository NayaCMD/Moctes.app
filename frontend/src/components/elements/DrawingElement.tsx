import type { PageElement } from "../../types/element.types";

interface DrawingElementProps {
  element: PageElement;
}

export function DrawingElement({ element }: DrawingElementProps) {
  if (element.content.kind !== "drawing") {
    return null;
  }

  return (
    <svg className="page-drawing-element" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {element.content.paths.map((path) => (
        <polyline
          key={path.id}
          points={path.points.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none"
          stroke={path.color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={path.width}
          opacity={path.opacity}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
