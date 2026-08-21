export type EditorTool =
  | "text"
  | "checklist"
  | "emojis"
  | "stickers"
  | "image"
  | "tapes"
  | "comments"
  | "new-page"
  | "pen-ruler"
  | "preview"
  | "favorite"
  | "erase";

export type ActiveToolPanel =
  | "emoji"
  | "shapes"
  | "stickers"
  | "images"
  | "tapes"
  | "comments"
  | "drawing"
  | "visibility"
  | "erase"
  | null;

export type EditorMode =
  | "select"
  | "text"
  | "checklist"
  | "comment"
  | "erase"
  | "erase-area"
  | "draw"
  | "ruler";

export type ZoomMode = "fit" | "manual";

export interface DrawingToolSettings {
  mode: "pen" | "highlighter";
  color: string;
  strokeWidth: number;
  opacity: number;
}

export interface RulerState {
  visible: boolean;
  x: number;
  y: number;
  rotation: number;
  length: number;
}
