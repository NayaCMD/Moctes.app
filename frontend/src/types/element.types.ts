import type { AssetReference } from "./asset.types";
import type { PostItElementContent } from "./postIt.types";

export type PageElementType =
  | "text"
  | "emoji"
  | "shape"
  | "sticker"
  | "image"
  | "tape"
  | "post-it"
  | "comment"
  | "drawing";

export interface TextElementContent {
  kind: "text";
  text: string;
}

export interface ImageElementContent extends AssetReference {
  kind: "image";
}

export interface StickerElementContent extends AssetReference {
  kind: "sticker";
}

export interface TapeElementContent extends AssetReference {
  kind: "tape";
}

export interface EmojiElementContent {
  kind: "emoji";
  emoji: string;
}

export interface ShapeElementContent {
  kind: "shape";
  shape: ShapeAppearance["shapeType"];
  label?: string;
  appearance: ShapeAppearance;
}

export interface ShapeAppearance {
  shapeType:
    | "circle"
    | "rectangle"
    | "rounded-rectangle"
    | "triangle"
    | "line"
    | "arrow"
    | "star"
    | "heart"
    | "custom-svg";
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  preserveAspectRatio: boolean;
  svgText?: string;
}

export interface CommentMessage {
  id: string;
  authorLabel: string;
  text: string;
  createdAt: string;
  editedAt?: string;
  attachments: CommentAttachment[];
}

export type CommentAttachment =
  | {
      type: "image";
      assetId: string;
    }
  | {
      type: "link";
      url: string;
      label?: string;
    }
  | {
      type: "video";
      url: string;
      label?: string;
    };

export interface CommentElementContent {
  kind: "comment";
  color: string;
  resolved: boolean;
  messages: CommentMessage[];
  createdAt: string;
}

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingPath {
  id: string;
  points: DrawingPoint[];
  color: string;
  width: number;
  opacity: number;
}

export interface DrawingElementContent {
  kind: "drawing";
  paths: DrawingPath[];
  svgPath?: string;
}

export type ElementContent =
  | TextElementContent
  | ImageElementContent
  | StickerElementContent
  | TapeElementContent
  | PostItElementContent
  | EmojiElementContent
  | ShapeElementContent
  | CommentElementContent
  | DrawingElementContent;

export interface TextElementStyle {
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline";
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
}

export interface BoxElementStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
  boxShadow?: string;
}

export interface ImageElementStyle {
  objectFit?: "cover" | "contain";
  opacity?: number;
  borderRadius?: number;
  boxShadow?: string;
}

export interface ElementStyle {
  text?: TextElementStyle;
  box?: BoxElementStyle;
  image?: ImageElementStyle;
}

export interface PageElement {
  id: string;
  type: PageElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  hidden: boolean;
  minWidth?: number;
  minHeight?: number;
  lockAspectRatio?: boolean;
  content: ElementContent;
  style: ElementStyle;
}
