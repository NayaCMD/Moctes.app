import { useAppStore } from "../../stores/useAppStore";
import type { InterfaceTheme } from "../../types/theme.types";

const themes: Array<{
  value: InterfaceTheme;
  label: string;
  color: string;
}> = [
  { value: "baby-pink", label: "Rosa bebe", color: "#f6b8c8" },
  { value: "baby-blue", label: "Azul bebe", color: "#9fcbe8" },
  { value: "white", label: "Branco", color: "#ffffff" },
  { value: "yellow", label: "Amarelo", color: "#f3d77d" },
  { value: "orange", label: "Laranja", color: "#f3ad72" },
  { value: "red", label: "Vermelho", color: "#e88484" },
];

export function ThemeSelector() {
  const interfaceTheme = useAppStore((state) => state.interfaceTheme);
  const setInterfaceTheme = useAppStore((state) => state.setInterfaceTheme);

  return (
    <div className="theme-selector">
      <p className="control-label">Cor do aplicativo</p>

      <div className="theme-swatches">
        {themes.map((theme) => {
          const selected = interfaceTheme === theme.value;

          return (
            <button
              key={theme.value}
              type="button"
              title={theme.label}
              aria-label={`Usar tema ${theme.label}`}
              aria-pressed={selected}
              onClick={() => setInterfaceTheme(theme.value)}
              className="theme-swatch"
              data-active={selected}
              style={{
                backgroundColor: theme.color,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
