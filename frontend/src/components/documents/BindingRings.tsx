import { NotebookRing } from "./NotebookRing";

interface BindingRingsProps {
  count?: number;
  orientation?: "vertical" | "horizontal";
  mode?: "closed" | "open";
}

export function BindingRings({
  count = 7,
  orientation = "vertical",
  mode = "open",
}: BindingRingsProps) {
  return (
    <div
      className="binding-rings"
      data-orientation={orientation}
      data-mode={mode}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="binding-ring">
          <NotebookRing index={index} mode={mode} />
        </span>
      ))}
    </div>
  );
}
