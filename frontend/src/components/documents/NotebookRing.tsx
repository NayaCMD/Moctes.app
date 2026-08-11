interface NotebookRingProps {
  index: number;
  mode: "closed" | "open";
}

export function NotebookRing({ index, mode }: NotebookRingProps) {
  return (
    <svg
      className="notebook-ring"
      data-mode={mode}
      viewBox="0 0 64 34"
      role="img"
      aria-label={`Argola ${index + 1}`}
      focusable="false"
    >
      <defs>
        <linearGradient id={`notebook-ring-metal-${index}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fbfbfb" />
          <stop offset="0.34" stopColor="#c7c4bf" />
          <stop offset="0.7" stopColor="#8f8b85" />
          <stop offset="1" stopColor="#e7e4df" />
        </linearGradient>
      </defs>
      <path
        className="notebook-ring__shadow"
        d="M7 18 C7 7 19 4 30 4 L42 4 C53 4 60 10 60 18 C60 26 53 30 42 30 L30 30 C19 30 7 29 7 18 Z"
      />
      <path
        className="notebook-ring__body"
        d="M7 18 C7 7 19 4 30 4 L42 4 C53 4 60 10 60 18 C60 26 53 30 42 30 L30 30 C19 30 7 29 7 18 Z"
        fill="none"
        stroke={`url(#notebook-ring-metal-${index})`}
        strokeLinecap="round"
        strokeWidth="8"
      />
      <path
        className="notebook-ring__highlight"
        d="M15 14 C20 9 28 9 36 9 L42 9 C48 9 53 12 55 16"
      />
      <path
        className="notebook-ring__gap"
        d="M55 18 C49 19 43 19 37 18"
      />
    </svg>
  );
}
