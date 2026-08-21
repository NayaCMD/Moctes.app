import type { CSSProperties, ReactNode } from "react";
import type { MoctesDocument } from "../../types/document.types";
import { NotebookSkin } from "./NotebookSkin";

interface NotebookCoverShellProps {
  document: MoctesDocument;
  children: ReactNode;
}

export function NotebookCoverShell({
  document,
  children,
}: NotebookCoverShellProps) {
  const style = {
    "--notebook-cover-color": document.coverColor,
    "--notebook-cover-border":
      document.coverBorderColor ?? "#8dcbd7",
    "--notebook-spine-color":
      document.spineColor ?? "#bdeff3",
    "--notebook-cover-texture-opacity": `${document.cover?.textureIntensity ?? 18}%`,
  } as CSSProperties;

  return (
    <div
      className="notebook-cover-shell"
      data-cover-material={document.cover?.material ?? "linen"}
      style={style}
    >
      <NotebookSkin />

      {children}
    </div>
  );
}
