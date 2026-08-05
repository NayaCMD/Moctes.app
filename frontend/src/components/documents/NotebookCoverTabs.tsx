interface NotebookCoverTabsProps {
  side: "left" | "right";
  position: "top" | "bottom";
  color: string;
}

export function NotebookCoverTabs({ side, position, color }: NotebookCoverTabsProps) {
  return (
    <span
      className="notebook-cover-tab"
      data-side={side}
      data-position={position}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}
