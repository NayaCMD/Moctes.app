import type { ReactNode } from "react";

interface DesktopWindowProps {
  children: ReactNode;
}

export function DesktopWindow({ children }: DesktopWindowProps) {
  return (
    <div className="app-frame">
      <section className="desktop-window" aria-label="Aplicativo Moctes">
        {children}
      </section>
    </div>
  );
}
