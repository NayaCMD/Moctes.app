import { useEffect, useRef } from "react";

export function useClickOutside<T extends HTMLElement>(
    onOutside: () => void,
    active = true,
) {
    const ref = useRef<T | null>(null);

    useEffect(() => {
        if (!active) {
            return undefined;
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onOutside();
            }
        };

        window.addEventListener("pointerdown", handlePointerDown);
        return () => window.removeEventListener("pointerdown", handlePointerDown);
    }, [active, onOutside]);

    return ref;
}
