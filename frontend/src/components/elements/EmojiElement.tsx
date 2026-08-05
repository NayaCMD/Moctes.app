import type { PageElement } from "../../types/element.types";
import { useEffect, useRef, useState } from "react";
import { getEmojiFontSizePx } from "../../utils/elementSizing.utils";

interface EmojiElementProps {
  element: PageElement;
}

export function EmojiElement({ element }: EmojiElementProps) {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const [fontSize, setFontSize] = useState(28);

  useEffect(() => {
    const elementNode = containerRef.current;
    if (!elementNode) {
      return undefined;
    }
    const updateSize = () => {
      const rect = elementNode.getBoundingClientRect();
      setFontSize(getEmojiFontSizePx(rect.width, rect.height));
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(elementNode);
    return () => observer.disconnect();
  }, []);

  if (element.content.kind !== "emoji") {
    return null;
  }

  return (
    <span
      ref={containerRef}
      className="page-emoji-element"
      style={{
        ...element.style.text,
        fontSize,
      }}
    >
      {element.content.emoji}
    </span>
  );
}
