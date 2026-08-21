import { useEffect, useState } from "react";

export const PHONE_EDITOR_QUERY = "(max-width: 700px)";
export const COARSE_POINTER_QUERY = "(pointer: coarse)";
export const COMPACT_TOUCH_EDITOR_QUERY = "(max-width: 900px) and (pointer: coarse)";

export function useMediaQuery(query: string): boolean {
  const readMatch = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(query).matches;
  const [matches, setMatches] = useState(readMatch);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [query]);

  return matches;
}

export function useIsPhoneEditor(): boolean {
  return useMediaQuery(PHONE_EDITOR_QUERY);
}

export function useIsCompactTouchEditor(): boolean {
  const isPhone = useIsPhoneEditor();
  const isCompactTouch = useMediaQuery(COMPACT_TOUCH_EDITOR_QUERY);
  return isPhone || isCompactTouch;
}

export function useVisualViewportMetrics(): void {
  useEffect(() => {
    const root = document.documentElement;
    const visualViewport = window.visualViewport;

    const update = () => {
      const height = visualViewport?.height ?? window.innerHeight;
      const keyboardInset = visualViewport
        ? Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop)
        : 0;

      root.style.setProperty("--mobile-visual-viewport-height", `${Math.round(height)}px`);
      root.style.setProperty("--mobile-keyboard-inset", `${Math.round(keyboardInset)}px`);
      root.dataset.virtualKeyboard = keyboardInset > 120 ? "open" : "closed";
    };

    update();
    visualViewport?.addEventListener("resize", update);
    visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      visualViewport?.removeEventListener("resize", update);
      visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      root.style.removeProperty("--mobile-visual-viewport-height");
      root.style.removeProperty("--mobile-keyboard-inset");
      delete root.dataset.virtualKeyboard;
    };
  }, []);
}
