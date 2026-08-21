import {
  Apple,
  Bike,
  Clock3,
  Heart,
  Lightbulb,
  PawPrint,
  Plane,
  Search,
  Smile,
  Sparkles,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  emojiById,
  emojiCatalog,
  searchEmojiCatalog,
} from "../../data/emojiCatalog";
import { useEmojiDrag } from "../../hooks/useEmojiDrag";
import { useEmojiPreferences } from "../../hooks/useEmojiPreferences";
import { useAuthStore } from "../../stores/useAuthStore";
import type {
  EmojiCatalogItem,
  EmojiPickerSectionId,
} from "../../types/emoji.types";

const PAGE_SIZE = 18;
const GRID_COLUMNS = 6;

interface EmojiSection {
  id: EmojiPickerSectionId;
  label: string;
  icon: LucideIcon;
}

const emojiSections: EmojiSection[] = [
  { id: "recent", label: "Recentes", icon: Clock3 },
  { id: "favorites", label: "Favoritos", icon: Heart },
  { id: "faces", label: "Rostos", icon: Smile },
  { id: "people", label: "Pessoas", icon: UserRound },
  { id: "animals", label: "Animais", icon: PawPrint },
  { id: "food", label: "Comida", icon: Apple },
  { id: "activities", label: "Atividades", icon: Bike },
  { id: "travel", label: "Viagens", icon: Plane },
  { id: "objects", label: "Objetos", icon: Lightbulb },
  { id: "symbols", label: "Símbolos", icon: Sparkles },
];

export interface EmojiPickOptions {
  keepOpen: boolean;
}

interface EmojiPickerProps {
  destinationLabel: string;
  onPick: (item: EmojiCatalogItem, options: EmojiPickOptions) => void;
  onDragInserted?: (item: EmojiCatalogItem, options: EmojiPickOptions) => void;
}

interface EmojiTileProps {
  item: EmojiCatalogItem;
  favorite: boolean;
  onPick: (item: EmojiCatalogItem) => void;
  onToggleFavorite: (item: EmojiCatalogItem) => void;
  onDragInserted: (item: EmojiCatalogItem) => void;
  onGridKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

function EmojiTile({
  item,
  favorite,
  onPick,
  onToggleFavorite,
  onDragInserted,
  onGridKeyDown,
}: EmojiTileProps) {
  const drag = useEmojiDrag(item, onDragInserted);

  return (
    <div className="emoji-tile" role="gridcell">
      <button
        type="button"
        className="emoji-option emoji-glyph"
        aria-label={`Inserir ${item.name}`}
        title={`${item.name} — arraste para posicionar`}
        onPointerDown={drag.onPointerDown}
        onKeyDown={onGridKeyDown}
        onClick={() => {
          if (!drag.shouldSuppressClick()) {
            onPick(item);
          }
        }}
      >
        {item.emoji}
      </button>
      <button
        type="button"
        className="emoji-favorite-action"
        data-favorite={favorite}
        aria-label={`${favorite ? "Remover" : "Adicionar"} ${item.name} ${
          favorite ? "dos" : "aos"
        } favoritos`}
        title={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite(item);
        }}
      >
        <Heart size={12} fill={favorite ? "currentColor" : "none"} aria-hidden="true" />
      </button>
    </div>
  );
}

export function EmojiPicker({
  destinationLabel,
  onPick,
  onDragInserted,
}: EmojiPickerProps) {
  const userId = useAuthStore((state) => state.user?.id ?? "anonymous");
  const { preferences, recordRecent, toggleFavorite, setKeepOpen } =
    useEmojiPreferences(userId);
  const [activeSectionId, setActiveSectionId] =
    useState<EmojiPickerSectionId>("faces");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo(() => {
    if (query.trim()) {
      return searchEmojiCatalog(query);
    }
    if (activeSectionId === "recent") {
      return preferences.recentIds.flatMap((id) => {
        const item = emojiById.get(id);
        return item ? [item] : [];
      });
    }
    if (activeSectionId === "favorites") {
      return preferences.favoriteIds.flatMap((id) => {
        const item = emojiById.get(id);
        return item ? [item] : [];
      });
    }
    return emojiCatalog.filter((item) => item.category === activeSectionId);
  }, [activeSectionId, preferences.favoriteIds, preferences.recentIds, query]);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;
  const activeSection =
    emojiSections.find((section) => section.id === activeSectionId) ?? emojiSections[2];

  useEffect(() => {
    if (!hasMore || typeof IntersectionObserver === "undefined") {
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisibleCount((count) => Math.min(count + PAGE_SIZE, items.length));
        }
      },
      { root: gridRef.current, rootMargin: "48px" },
    );
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    return () => observer.disconnect();
  }, [hasMore, items.length, visibleCount]);

  const handleGridKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const buttons = Array.from(
      gridRef.current?.querySelectorAll<HTMLButtonElement>(".emoji-option") ?? [],
    );
    const currentIndex = buttons.indexOf(event.currentTarget);
    if (currentIndex < 0) {
      return;
    }
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = Math.min(currentIndex + 1, buttons.length - 1);
        break;
      case "ArrowLeft":
        nextIndex = Math.max(currentIndex - 1, 0);
        break;
      case "ArrowDown":
        nextIndex = Math.min(currentIndex + GRID_COLUMNS, buttons.length - 1);
        break;
      case "ArrowUp":
        nextIndex = Math.max(currentIndex - GRID_COLUMNS, 0);
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = buttons.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    buttons[nextIndex]?.focus();
  };

  const handleCategoryKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
      return;
    }
    const buttons = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='tab']") ??
        [],
    );
    const currentIndex = buttons.indexOf(event.currentTarget);
    if (currentIndex < 0) {
      return;
    }
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % buttons.length
            : (currentIndex - 1 + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[nextIndex]?.focus();
    buttons[nextIndex]?.click();
  };

  const insertItem = (item: EmojiCatalogItem) => {
    recordRecent(item.id);
    onPick(item, { keepOpen: preferences.keepOpen });
  };

  const finishDrag = (item: EmojiCatalogItem) => {
    recordRecent(item.id);
    onDragInserted?.(item, { keepOpen: preferences.keepOpen });
  };

  const emptyCopy = query.trim()
    ? `Nenhum emoji encontrado para “${query.trim()}”.`
    : activeSectionId === "recent"
      ? "Seus emojis usados recentemente aparecerão aqui."
      : "Favorite um emoji pelo coração para encontrá-lo aqui.";

  return (
    <div className="emoji-picker" aria-label="Escolher emoji">
      <label className="emoji-search">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Buscar emojis</span>
        <input
          ref={searchRef}
          type="search"
          value={query}
          placeholder="Buscar por nome ou ideia…"
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              gridRef.current?.querySelector<HTMLButtonElement>(".emoji-option")?.focus();
            }
          }}
        />
        {query && (
          <button
            type="button"
            className="emoji-search-clear"
            aria-label="Limpar busca"
            onClick={() => {
              setQuery("");
              setVisibleCount(PAGE_SIZE);
              searchRef.current?.focus();
            }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </label>

      <div className="emoji-category-tabs" role="tablist" aria-label="Categorias de emoji">
        {emojiSections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              id={`emoji-tab-${section.id}`}
              aria-label={section.label}
              title={section.label}
              aria-selected={!query && activeSectionId === section.id}
              aria-controls="emoji-results"
              data-active={!query && activeSectionId === section.id}
              onKeyDown={handleCategoryKeyDown}
              onClick={() => {
                setQuery("");
                setActiveSectionId(section.id);
                setVisibleCount(PAGE_SIZE);
              }}
            >
              <Icon size={17} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className="emoji-results-heading">
        <strong>{query.trim() ? "Resultados" : activeSection.label}</strong>
        <span aria-live="polite">
          {items.length} {items.length === 1 ? "emoji" : "emojis"}
        </span>
      </div>

      <div
        ref={gridRef}
        id="emoji-results"
        className="emoji-grid-scroll"
        role="tabpanel"
        aria-labelledby={query ? undefined : `emoji-tab-${activeSection.id}`}
      >
        {visibleItems.length > 0 ? (
          <div className="emoji-grid" role="grid" aria-label="Emojis disponíveis">
            {visibleItems.map((item) => (
              <EmojiTile
                key={item.id}
                item={item}
                favorite={preferences.favoriteIds.includes(item.id)}
                onPick={insertItem}
                onToggleFavorite={(selected) => toggleFavorite(selected.id)}
                onDragInserted={finishDrag}
                onGridKeyDown={handleGridKeyDown}
              />
            ))}
          </div>
        ) : (
          <div className="emoji-empty-state" role="status">
            <Search size={24} aria-hidden="true" />
            <strong>Nada por aqui</strong>
            <span>{emptyCopy}</span>
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setVisibleCount(PAGE_SIZE);
                }}
              >
                Limpar busca
              </button>
            )}
          </div>
        )}
        {hasMore && (
          <div ref={loadMoreRef} className="emoji-load-more">
            <button
              type="button"
              onClick={() =>
                setVisibleCount((count) => Math.min(count + PAGE_SIZE, items.length))
              }
            >
              Carregar mais emojis
            </button>
          </div>
        )}
      </div>

      <div className="emoji-picker-footer">
        <label className="emoji-keep-open">
          <input
            type="checkbox"
            checked={preferences.keepOpen}
            onChange={(event) => setKeepOpen(event.target.checked)}
          />
          Manter aberto para inserir vários
        </label>
        <p className="tool-target-note" aria-live="polite">
          {destinationLabel}
        </p>
      </div>
    </div>
  );
}
