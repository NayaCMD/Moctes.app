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

  const { asset, emoji, label } = element.content;

  if (asset?.kind === "image" && asset.src) {
    return (
      <span ref={containerRef} className="page-emoji-element" title={label}>
        <img className="page-emoji-custom-asset" src={asset.src} alt={label ?? "Emoji"} />
      </span>
    );
  }

  return (
    <span
      ref={containerRef}
      className="page-emoji-element emoji-glyph"
      title={label}
      style={{
        ...element.style.text,
        fontSize,
        fontFamily: asset?.fontFamily ?? undefined,
      }}
    >
      {emoji}
    </span>
  );
}
