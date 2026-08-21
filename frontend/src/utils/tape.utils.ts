import type {
  ElementContent,
  TapeEdgeStyle,
  TapeElementContent,
  TapeRenderMode,
} from "../types/element.types";

export const DEFAULT_TAPE_RENDER_MODE: TapeRenderMode = "repeat";
export const DEFAULT_TAPE_EDGE_STYLE: TapeEdgeStyle = "torn-soft";

const tapeRenderModes = new Set<TapeRenderMode>(["repeat", "crop"]);
const tapeEdgeStyles = new Set<TapeEdgeStyle>([
  "straight",
  "torn-soft",
  "torn-rough",
]);

export function normalizeTapeContent(
  content: ElementContent,
): ElementContent {
  if (content.kind !== "tape") return content;

  const renderMode = tapeRenderModes.has(content.renderMode as TapeRenderMode)
    ? content.renderMode
    : DEFAULT_TAPE_RENDER_MODE;
  const edgeStyle = tapeEdgeStyles.has(content.edgeStyle as TapeEdgeStyle)
    ? content.edgeStyle
    : DEFAULT_TAPE_EDGE_STYLE;

  if (content.renderMode === renderMode && content.edgeStyle === edgeStyle) {
    return content;
  }

  return { ...content, renderMode, edgeStyle } as TapeElementContent;
}
