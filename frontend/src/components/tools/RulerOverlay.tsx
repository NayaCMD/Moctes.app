import { useEditorStore } from "../../stores/useEditorStore";

export function RulerOverlay() {
  const ruler = useEditorStore((state) => state.ruler);
  const setRuler = useEditorStore((state) => state.setRuler);

  if (!ruler.visible) {
    return null;
  }

  return (
    <div
      className="ruler-overlay"
      style={{
        left: `${ruler.x}%`,
        top: `${ruler.y}%`,
        width: `${ruler.length}%`,
        transform: `translate(-50%, -50%) rotate(${ruler.rotation}deg)`,
      }}
      role="slider"
      aria-label="Regua"
      tabIndex={0}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const startX = event.clientX;
        const startY = event.clientY;
        const start = ruler;
        const containerRect = event.currentTarget.parentElement?.getBoundingClientRect();
        event.currentTarget.setPointerCapture(event.pointerId);

        const handleMove = (moveEvent: PointerEvent) => {
          const deltaX = containerRect ? ((moveEvent.clientX - startX) / containerRect.width) * 100 : 0;
          const deltaY = containerRect ? ((moveEvent.clientY - startY) / containerRect.height) * 100 : 0;
          setRuler({
            x: Math.max(6, Math.min(94, start.x + deltaX)),
            y: Math.max(8, Math.min(92, start.y + deltaY)),
          });
        };
        const handleUp = () => {
          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleUp);
        };
        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
      }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 4 : 1;
        if (event.key === "Escape") {
          setRuler({ visible: false });
        }
        if (event.key === "ArrowLeft") {
          setRuler({ x: Math.max(6, ruler.x - step) });
        }
        if (event.key === "ArrowRight") {
          setRuler({ x: Math.min(94, ruler.x + step) });
        }
        if (event.key === "ArrowUp") {
          setRuler({ y: Math.max(8, ruler.y - step) });
        }
        if (event.key === "ArrowDown") {
          setRuler({ y: Math.min(92, ruler.y + step) });
        }
      }}
    >
      <span />
    </div>
  );
}
