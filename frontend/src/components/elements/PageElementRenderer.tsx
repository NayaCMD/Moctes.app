import type { PageElement } from "../../types/element.types";
import { CommentElement } from "./CommentElement";
import { DrawingElement } from "./DrawingElement";
import { ElementFrame } from "./ElementFrame";
import { EmojiElement } from "./EmojiElement";
import { ImageElement } from "./ImageElement";
import { PostItElement } from "./PostItElement";
import { ShapeElement } from "./ShapeElement";
import { StickerElement } from "./StickerElement";
import { TapeElement } from "./TapeElement";
import { TextElement } from "./TextElement";

interface PageElementRendererProps {
  element: PageElement;
  pageId: string;
  pageElement: HTMLElement | null;
}

export function PageElementRenderer({ element, pageId, pageElement }: PageElementRendererProps) {
  return (
    <ElementFrame element={element} pageId={pageId} pageElement={pageElement}>
      {element.type === "text" && <TextElement element={element} />}
      {element.type === "emoji" && <EmojiElement element={element} />}
      {element.type === "image" && <ImageElement element={element} />}
      {element.type === "sticker" && <StickerElement element={element} />}
      {element.type === "tape" && <TapeElement element={element} />}
      {element.type === "post-it" && <PostItElement element={element} />}
      {element.type === "shape" && <ShapeElement element={element} />}
      {element.type === "comment" && <CommentElement element={element} />}
      {element.type === "drawing" && <DrawingElement element={element} />}
    </ElementFrame>
  );
}
