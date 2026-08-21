import { CalendarDays, FileArchive, NotebookPen, Star } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import type { TopTab } from "../../types/document.types";

const topTabs: Array<{
  id: TopTab;
  label: string;
  description: string;
  icon: typeof Star;
}> = [
  { id: "favorites", label: "Favoritos", description: "Itens que você marcou", icon: Star },
  { id: "files", label: "Arquivos", description: "Todos os seus documentos", icon: FileArchive },
  { id: "current-note", label: "Documento atual", description: "Voltar ao editor", icon: NotebookPen },
  { id: "calendar", label: "Calendário", description: "Organização por data", icon: CalendarDays },
];

export function TopDock({ onNavigate }: { onNavigate?: () => void }) {
  const activeTopTab = useAppStore((state) => state.activeTopTab);
  const setActiveTopTab = useAppStore((state) => state.setActiveTopTab);

  return (
    <nav className="top-dock" aria-label="Áreas do Moctes">
      <div className="dropdown-menu-heading">Navegação</div>
      <div className="top-dock-track" role="none">
        {topTabs.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTopTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              className="top-dock-tab"
              data-active={selected}
              onClick={() => {
                setActiveTopTab(tab.id);
                onNavigate?.();
              }}
            >
              <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
              <span>
                <strong>{tab.label}</strong>
                <small>{tab.description}</small>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
