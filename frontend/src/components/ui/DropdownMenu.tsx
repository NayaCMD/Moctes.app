import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface DropdownMenuProps {
  ariaLabel: string;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  className?: string;
  triggerClassName?: string;
}

export function DropdownMenu({
  ariaLabel,
  trigger,
  children,
  align = "end",
  className = "",
  triggerClassName = "",
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const close = () => setOpen(false);
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        rootRef.current?.querySelector<HTMLButtonElement>(".dropdown-menu-trigger")?.focus();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => {
      rootRef.current
        ?.querySelector<HTMLElement>("[role='menuitem'], [role='menuitemradio']")
        ?.focus({ preventScroll: true });
    }, 0);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`dropdown-menu ${className}`.trim()}>
      <button
        type="button"
        className={`dropdown-menu-trigger ${triggerClassName}`.trim()}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          className="dropdown-menu-popover"
          data-align={align}
          role="menu"
          aria-label={ariaLabel}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
