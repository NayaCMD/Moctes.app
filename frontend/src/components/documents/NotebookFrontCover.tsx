import type { CSSProperties, KeyboardEvent } from "react";
import type { NotebookBookPhase, NotebookCover as NotebookCoverModel } from "../../types/notebook.types";

interface NotebookFrontCoverProps {
  cover: NotebookCoverModel;
  phase: NotebookBookPhase;
  disabled: boolean;
  onOpen: () => void;
  onTransitionEnd: () => void;
}

export function NotebookFrontCover({
  cover,
  phase,
  disabled,
  onOpen,
  onTransitionEnd,
}: NotebookFrontCoverProps) {
  const style = {
    "--notebook-cover-color": cover.color,
    "--notebook-cover-border-color": cover.borderColor,
    "--notebook-cover-radius": `${cover.cornerRadius}px`,
    "--notebook-cover-texture-opacity": `${cover.textureIntensity ?? 18}%`,
  } as CSSProperties;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <button
      type="button"
      className="notebook-front-cover"
      data-phase={phase}
      data-cover-material={cover.material ?? "linen"}
      aria-label="Abrir caderno"
      aria-hidden={phase === "open" ? "true" : undefined}
      disabled={disabled || phase === "open"}
      style={style}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && event.propertyName === "transform") {
          onTransitionEnd();
        }
      }}
    >
      <span className="notebook-front-cover__face notebook-front-cover__front" aria-hidden="true">
        <span className="notebook-front-cover__stitch" />
        <span className="notebook-front-cover__elastic" />
        <span className="notebook-front-cover__clasp" />
      </span>
      <span className="notebook-front-cover__face notebook-front-cover__back" aria-hidden="true" />
    </button>
  );
}
