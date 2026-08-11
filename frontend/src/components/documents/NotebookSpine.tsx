import { BindingRings } from "./BindingRings";

interface NotebookSpineProps {
  mode?: "closed" | "open";
}

export function NotebookSpine({ mode = "open" }: NotebookSpineProps) {
  return (
    <div className="notebook-spread-spine" aria-hidden="true">
      <BindingRings orientation="vertical" count={8} mode={mode} />
    </div>
  );
}
