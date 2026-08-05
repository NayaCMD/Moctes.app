import type { ReactNode } from "react";
import moctesLogo from "../../assets/moctes-logo.svg";

interface DesktopWindowProps {
  children: ReactNode;
}

export function DesktopWindow({ children }: DesktopWindowProps) {
  return (
    <div className="app-frame">
      <section className="desktop-window" aria-label="Aplicativo Moctes">
        <header className="window-titlebar">
          <div className="window-controls" aria-hidden="true">
          </div>

          <div className="window-brand">
            <img
              src={moctesLogo}
              alt=""
              className="window-brand-logo"
              aria-hidden="true"
            />

            <span>Moctes</span>
          </div>
        </header>

        {children}
      </section>
    </div>
  );
}
