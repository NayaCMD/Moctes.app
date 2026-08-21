import type { LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";
import type { EditorTool } from "../../types/editor.types";
import type { ToolPopoverAnchor } from "../tools/ToolPopover";

interface ToolButtonProps {
  id: EditorTool;
  label: string;
  icon: LucideIcon;
  tone: string;
  variant?: "tool" | "command" | "danger";
  active: boolean;
  disabled?: boolean;
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
  variant = "tool",
  active,
  disabled = false,
  onSelect,
}: ToolButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    onSelect(id, getAnchorFromButton(event.currentTarget), event.currentTarget);
  };

  return (
    <button
      type="button"
      className="tool-button"
      data-label={label}
      data-active={active}
      data-tone={tone}
      data-variant={variant}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={handleClick}
    >
      <Icon size={20} strokeWidth={2} />
    </button>
  );
}
