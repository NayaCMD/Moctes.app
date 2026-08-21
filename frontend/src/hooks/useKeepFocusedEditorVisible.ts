import { useEffect, type RefObject } from "react";

export function useKeepFocusedEditorVisible(
  active: boolean,
  editorRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!active) return;

    let frame = 0;
    const reveal = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const editor = editorRef.current;
        if (typeof editor?.scrollIntoView === "function") {
          editor.scrollIntoView({ block: "center", inline: "center" });
        }
      });
    };

    reveal();
    window.visualViewport?.addEventListener("resize", reveal);
    window.addEventListener("orientationchange", reveal);
    return () => {
      window.cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener("resize", reveal);
      window.removeEventListener("orientationchange", reveal);
    };
  }, [active, editorRef]);
}
