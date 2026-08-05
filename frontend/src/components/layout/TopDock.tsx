import {
  CalendarDays,
  FileArchive,
  NotebookPen,
  Settings,
  Star,
  UserRound,
} from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import type { TopTab } from "../../types/document.types";

const topTabs: Array<{
  id: TopTab;
  label: string;
  icon: typeof Star;
}> = [
  { id: "favorites", label: "Favoritos", icon: Star },
  { id: "files", label: "Arquivos", icon: FileArchive },
  { id: "current-note", label: "Anotação atual", icon: NotebookPen },
  { id: "calendar", label: "Calendário", icon: CalendarDays },
  { id: "user", label: "Usuário", icon: UserRound },
  { id: "settings", label: "Configurações", icon: Settings },
];

export function TopDock() {
  const activeTopTab = useAppStore((state) => state.activeTopTab);
  const setActiveTopTab = useAppStore((state) => state.setActiveTopTab);

  return (
    <nav className="top-dock" aria-label="Navegação principal">
      <div className="top-dock-track">
        {topTabs.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTopTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              aria-label={tab.label}
              aria-pressed={selected}
              className="top-dock-tab"
              data-active={selected}
              title={tab.label}
              onClick={() => setActiveTopTab(tab.id)}
            >
              <Icon size={23} strokeWidth={1.8} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
