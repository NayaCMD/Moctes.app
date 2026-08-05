interface BindingRingsProps {
  count?: number;
  orientation?: "vertical" | "horizontal";
}

export function BindingRings({
  count = 7,
  orientation = "vertical",
}: BindingRingsProps) {
  return (
    <div
      className="binding-rings"
      data-orientation={orientation}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="binding-ring">
          <span />
        </span>
      ))}
    </div>
  );
}
