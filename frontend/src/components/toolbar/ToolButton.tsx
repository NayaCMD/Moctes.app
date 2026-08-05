import type { LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";
import type { EditorTool } from "../../types/editor.types";
import type { ToolPopoverAnchor } from "../tools/ToolPopover";

interface ToolButtonProps {
  id: EditorTool;
  label: string;
  icon: LucideIcon;
  tone: string;
  active: boolean;
  onSelect: (tool: EditorTool, anchor: ToolPopoverAnchor, button: HTMLButtonElement) => void;
}

function getAnchorFromButton(button: HTMLButtonElement): ToolPopoverAnchor {
  const rect = button.getBoundingClientRect();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

export function ToolButton({
  id,
  label,
  icon: Icon,
  tone,
  active,
  onSelect,
}: ToolButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onSelect(id, getAnchorFromButton(event.currentTarget), event.currentTarget);
  };

  return (
    <button
      type="button"
      className="tool-button"
      data-active={active}
      data-tone={tone}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={handleClick}
    >
      <Icon size={20} strokeWidth={2} />
    </button>
  );
}
