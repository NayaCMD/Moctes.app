import type {
  NotebookTransitionDirection,
  NotebookTransitionPhase,
} from "../../types/notebook.types";

interface NotebookPageCurlProps {
  direction: NotebookTransitionDirection;
  phase: NotebookTransitionPhase;
}

export function NotebookPageCurl({ direction, phase }: NotebookPageCurlProps) {
  return (
    <svg
      className="notebook-page-curl"
      data-direction={direction}
      data-phase={phase}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="notebook-curl-paper" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fffdf8" stopOpacity="0" />
          <stop offset="0.48" stopColor="#fffaf2" stopOpacity="0.52" />
          <stop offset="0.72" stopColor="#eee6da" stopOpacity="0.74" />
          <stop offset="1" stopColor="#fffdf8" stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id="notebook-curl-shadow" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#5b5146" stopOpacity="0" />
          <stop offset="0.62" stopColor="#6d6258" stopOpacity="0.22" />
          <stop offset="1" stopColor="#5b5146" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="notebook-curl-highlight" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.56" stopColor="#ffffff" stopOpacity="0.72" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        className="notebook-page-curl__paper"
        d="M58 0 C79 8 92 23 91 44 C91 56 85 65 76 75 C68 84 69 91 84 100 L100 100 L100 0 Z"
      />
      <path
        className="notebook-page-curl__shadow"
        d="M64 0 C81 15 85 28 84 45 C84 59 76 70 68 80 C62 88 65 95 76 100"
      />
      <path
        className="notebook-page-curl__highlight"
        d="M78 0 C92 18 94 34 90 50 C86 66 75 78 71 89 C69 94 72 98 80 100"
      />
      <path
        className="notebook-page-curl__edge"
        d="M58 0 C79 8 92 23 91 44 C91 56 85 65 76 75 C68 84 69 91 84 100"
      />
    </svg>
  );
}
