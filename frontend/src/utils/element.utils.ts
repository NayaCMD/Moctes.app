import { assetCatalog } from "../data/assetCatalog";
import type { SidebarAsset } from "../types/document.types";
import type { EditorTool } from "../types/editor.types";
import type {
  ElementContent,
  PageElement,
  PageElementType,
  ShapeAppearance,
} from "../types/element.types";
import {
  getAssetElementDimensions,
  getElementSizing,
} from "./elementSizing.utils";
import { createPostItElement } from "./postIt.utils";
import { createShapeAppearance } from "./shape.utils";
import {
  DEFAULT_TAPE_EDGE_STYLE,
  DEFAULT_TAPE_RENDER_MODE,
} from "./tape.utils";
import { createChecklistElement } from "./checklist.utils";

export function createElementFromTool(
  tool: EditorTool,
  position: { x: number; y: number },
): PageElement | null {
  const base = {
    id: crypto.randomUUID(),
    x: position.x,
    y: position.y,
    rotation: 0,
    zIndex: 10,
    locked: false,
    hidden: false,
  };

  switch (tool) {
    case "text":
      return textElement(base.x, base.y);
    case "checklist":
      return createChecklistElement({ x: base.x, y: base.y });
    case "emojis": {
      const size = getElementSizing("emoji");
      return makeElement({
        ...base,
        type: "emoji",
        width: size.defaultWidth,
        height: size.defaultHeight,
        minWidth: size.minWidth,
        minHeight: size.minHeight,
        lockAspectRatio: size.lockAspectRatioByDefault,
        content: { kind: "emoji", emoji: "✨" },
        style: { text: { textAlign: "center" } },
      });
    }
    case "stickers":
      return createShapeElement({
        shape: "rounded-rectangle",
        x: base.x,
        y: base.y,
        fillColor: "#cbe58d",
        strokeColor: "rgba(80,91,112,0.42)",
        strokeWidth: 2,
      });
    case "image":
      return assetElement("image", "image", assetCatalog.notepadReference, base.x, base.y);
    case "tapes":
      return assetElement("tape", "tape", assetCatalog.tapeBlue, base.x, base.y);
    case "comments":
      return createCommentElement({ x: base.x, y: base.y, text: "Comentário" });
    default:
      return null;
  }
}

export function createElementFromAsset(
  asset: SidebarAsset,
  position: { x: number; y: number } = { x: 38, y: 38 },
): PageElement {
  if (asset.category === "post-its") {
    return {
      ...createPostItElement({
        x: position.x,
        y: position.y,
        text: "nota",
      }),
      zIndex: 10,
    };
  }

  if (asset.category === "tapes") {
    return assetElement("tape", "tape", asset, position.x, position.y);
  }

  if (asset.category === "stickers") {
    const sticker = assetElement("sticker", "image", asset, position.x, position.y);
    return {
      ...sticker,
      type: "sticker",
      content: { kind: "sticker", assetId: asset.id, src: asset.src, alt: asset.label },
    };
  }

  return assetElement("image", "image", asset, position.x, position.y);
}

export function createShapeElement(options: {
  shape: ShapeAppearance["shapeType"];
  x?: number;
  y?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  svgText?: string;
}): PageElement {
  const size = getElementSizing("shape");
  const wide = options.shape === "line" || options.shape === "arrow";
  const appearance = createShapeAppearance(options.shape, {
    fillColor: options.fillColor,
    strokeColor: options.strokeColor,
    strokeWidth: options.strokeWidth,
    opacity: options.opacity,
    svgText: options.svgText,
  });

  return makeElement({
    id: crypto.randomUUID(),
    type: "shape",
    x: options.x ?? 40,
    y: options.y ?? 40,
    width: wide ? 26 : size.defaultWidth,
    height: wide ? 6 : size.defaultHeight,
    minWidth: size.minWidth,
    minHeight: size.minHeight,
    lockAspectRatio: appearance.preserveAspectRatio,
    rotation: 0,
    zIndex: 10,
    locked: false,
    hidden: false,
    content: {
      kind: "shape",
      shape: options.shape,
      appearance,
    },
    style: {},
  });
}

export function createCommentElement(options: {
  x: number;
  y: number;
  text: string;
  color?: string;
  authorLabel?: string;
}): PageElement {
  const size = getElementSizing("comment");
  const createdAt = new Date().toISOString();
  return makeElement({
    id: crypto.randomUUID(),
    type: "comment",
    x: options.x,
    y: options.y,
    width: size.defaultWidth,
    height: size.defaultHeight,
    minWidth: size.minWidth,
    minHeight: size.minHeight,
    lockAspectRatio: true,
    rotation: 0,
    zIndex: 10,
    locked: false,
    hidden: false,
    content: {
      kind: "comment",
      color: options.color ?? "#8da3ed",
      resolved: false,
      createdAt,
      messages: [
        {
          id: `msg-${crypto.randomUUID()}`,
          authorLabel: options.authorLabel?.trim() || "Pessoa usuária",
          text: options.text,
          createdAt,
          attachments: [],
        },
      ],
    },
    style: {},
  });
}

function assetElement(
  type: PageElementType,
  kind: "image" | "tape",
  asset: {
    id: string;
    src: string;
    label: string;
    width?: number;
    height?: number;
  },
  x: number,
  y: number,
): PageElement {
  const size = getElementSizing(
    type === "tape" ? "tape" : type === "sticker" ? "sticker" : "image",
  );
  const assetDimensions =
    kind === "image"
      ? getAssetElementDimensions({
          type: type === "sticker" ? "sticker" : "image",
          intrinsicWidth: asset.width,
          intrinsicHeight: asset.height,
        })
      : null;
  const content: ElementContent =
    kind === "image"
      ? { kind: "image", assetId: asset.id, src: asset.src, alt: asset.label }
      : {
          kind: "tape",
          assetId: asset.id,
          src: asset.src,
          alt: asset.label,
          renderMode: DEFAULT_TAPE_RENDER_MODE,
          edgeStyle: DEFAULT_TAPE_EDGE_STYLE,
        };

  return makeElement({
    id: crypto.randomUUID(),
    type,
    x,
    y,
    width: assetDimensions?.width ?? size.defaultWidth,
    height: assetDimensions?.height ?? size.defaultHeight,
    minWidth: size.minWidth,
    minHeight: size.minHeight,
    lockAspectRatio: size.lockAspectRatioByDefault,
    rotation: kind === "image" ? -2 : 0,
    zIndex: 10,
    locked: false,
    hidden: false,
    content,
    style: {
      image: {
        objectFit: kind === "image" ? "contain" : "cover",
        borderRadius: kind === "image" ? 6 : 8,
        boxShadow: kind === "image" ? "0 8px 14px rgba(71,83,113,0.14)" : undefined,
      },
    },
  });
}

function textElement(x: number, y: number): PageElement {
  const size = getElementSizing("text");
  return makeElement({
    id: crypto.randomUUID(),
    x,
    y,
    rotation: 0,
    zIndex: 10,
    locked: false,
    hidden: false,
    type: "text",
    width: size.defaultWidth,
    height: size.defaultHeight,
    minWidth: size.minWidth,
    minHeight: size.minHeight,
    content: { kind: "text", text: "Digite aqui" },
    style: {
      text: {
        color: "#26324a",
        fontSize: 14,
        lineHeight: 1.35,
      },
    },
  });
}

function makeElement(element: PageElement): PageElement {
  return {
    ...element,
    id: element.id.startsWith("el-") ? element.id : `el-${element.id}`,
  };
}
