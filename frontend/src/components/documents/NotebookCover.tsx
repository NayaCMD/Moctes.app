import type { CSSProperties } from "react";
import type {
  NotebookBinding,
  NotebookCover as NotebookCoverModel,
} from "../../types/notebook.types";

interface NotebookCoverProps {
  cover: NotebookCoverModel;
  binding: NotebookBinding;
}

export function NotebookCover({ cover, binding }: NotebookCoverProps) {
  const style = {
    "--notebook-cover-color": cover.color,
    "--notebook-cover-border-color": cover.borderColor,
    "--notebook-cover-radius": `${cover.cornerRadius}px`,
  } as CSSProperties;

  return (
    <div
      className="notebook-cover"
      data-binding={binding}
      aria-hidden="true"
      style={style}
    />
  );
}
