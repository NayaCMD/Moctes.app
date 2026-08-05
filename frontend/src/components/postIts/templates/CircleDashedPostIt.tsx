import { useId } from "react";

interface CircleDashedPostItProps {
  backgroundColor?: string;
  patternColor?: string;
  patternOpacity?: number;
  preserveAspectRatio?: boolean;
  className?: string;
}

export function CircleDashedPostIt({
  backgroundColor = "#D3E7FF",
  patternColor = "#8EC2FF",
  patternOpacity = 1,
  preserveAspectRatio = true,
  className,
}: CircleDashedPostItProps) {
  const reactId = useId().replaceAll(":", "");
  const patternId = `circle-dashed-pattern-${reactId}`;
  const clipId = `circle-dashed-clip-${reactId}`;

  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 100 100"
      preserveAspectRatio={preserveAspectRatio ? "xMidYMid meet" : "none"}
      focusable="false"
      style={{ pointerEvents: "none" }}
    >
      <defs>
        <pattern id={patternId} width="100" height="11.7" patternUnits="userSpaceOnUse">
          <line
            x1="0"
            y1="5.85"
            x2="100"
            y2="5.85"
            stroke={patternColor}
            strokeWidth="0.55"
            strokeDasharray="1.1 1.6"
            strokeOpacity={patternOpacity}
            vectorEffect="non-scaling-stroke"
          />
        </pattern>
        <clipPath id={clipId}>
          <rect width="100" height="100" rx="50" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <rect width="100" height="100" rx="50" fill={backgroundColor} />
        <rect width="100" height="100" rx="50" fill={`url(#${patternId})`} />
      </g>
    </svg>
  );
}
