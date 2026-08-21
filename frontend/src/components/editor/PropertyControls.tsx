import type { CSSProperties, ReactNode } from "react";

export function PropertySection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="property-section">
      <header className="property-section-header">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </header>
      <div className="property-section-content">{children}</div>
    </section>
  );
}

export function ColorControl({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="color-control" htmlFor={id}>
      <span>{label}</span>
      <span className="color-control-field">
        <span
          className="color-control-swatch"
          style={{ backgroundColor: value }}
          aria-hidden="true"
        />
        <code>{value.toUpperCase()}</code>
        <input
          id={id}
          type="color"
          value={value}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}

export function SliderControl({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  const progress = ((value - min) / (max - min)) * 100;
  const style = { "--slider-progress": `${progress}%` } as CSSProperties;

  return (
    <label className="slider-control" htmlFor={id}>
      <span className="slider-control-label">
        <span>{label}</span>
        <output htmlFor={id}>{value}{unit}</output>
      </span>
      <input
        id={id}
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        style={style}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
