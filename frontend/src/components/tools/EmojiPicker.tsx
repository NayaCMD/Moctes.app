import { useState } from "react";

const emojiGroups = [
  { id: "recent", label: "Recentes", items: ["✨", "💙", "🌿", "📌", "☕", "⭐"] },
  { id: "faces", label: "Rostos", items: ["😊", "🥰", "😄", "😌", "🤔", "😭", "😉", "😴", "🤍", "😎"] },
  { id: "nature", label: "Natureza", items: ["🌿", "🌸", "🍓", "🌙", "☀️", "🍀", "🌼", "🌷", "🍄", "🌊"] },
  { id: "objects", label: "Objetos", items: ["📚", "✏️", "☕", "🎧", "📷", "🧷", "📝", "💌", "🕯️", "🎀"] },
  { id: "symbols", label: "Simbolos", items: ["✨", "✅", "📌", "💬", "🎵", "☁️", "💙", "💜", "💛", "⭐"] },
] as const;

type EmojiGroupId = (typeof emojiGroups)[number]["id"];

interface EmojiPickerProps {
  destinationLabel: string;
  onPick: (emoji: string) => void;
}

export function EmojiPicker({ destinationLabel, onPick }: EmojiPickerProps) {
  const [activeGroupId, setActiveGroupId] = useState<EmojiGroupId>("recent");
  const activeGroup = emojiGroups.find((group) => group.id === activeGroupId) ?? emojiGroups[0];

  return (
    <div className="emoji-picker" aria-label="Escolher emoji">
      <div className="tool-tabs compact" role="tablist" aria-label="Categorias de emoji">
        {emojiGroups.map((group) => (
          <button
            key={group.id}
            type="button"
            role="tab"
            id={`emoji-tab-${group.id}`}
            aria-selected={activeGroupId === group.id}
            aria-controls={`emoji-panel-${group.id}`}
            data-active={activeGroupId === group.id}
            onClick={() => setActiveGroupId(group.id)}
          >
            {group.label}
          </button>
        ))}
      </div>
      <div
        id={`emoji-panel-${activeGroup.id}`}
        className="emoji-grid"
        role="tabpanel"
        aria-labelledby={`emoji-tab-${activeGroup.id}`}
      >
        {activeGroup.items.map((emoji) => (
          <button key={emoji} type="button" aria-label={`Inserir emoji ${emoji}`} onClick={() => onPick(emoji)}>
            {emoji}
          </button>
        ))}
      </div>
      <p className="tool-target-note" aria-live="polite">
        {destinationLabel}
      </p>
    </div>
  );
}
