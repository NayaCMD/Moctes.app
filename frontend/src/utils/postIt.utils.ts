import type { PageElement } from "../types/element.types";
import type { PostItAppearance, PostItElementContent, PostItTemplateId } from "../types/postIt.types";
import { createId } from "./document.utils";
import { getDefaultElementSize } from "./insertion.utils";

export const DEFAULT_POST_IT_APPEARANCE: PostItAppearance = {
  templateId: "circle-dashed",
  backgroundColor: "#D3E7FF",
  patternColor: "#8EC2FF",
  textColor: "#315E91",
  patternOpacity: 1,
  preserveAspectRatio: true,
};

const AVAILABLE_POST_IT_TEMPLATE_IDS = ["circle-dashed"] as const satisfies readonly PostItTemplateId[];

interface CreatePostItElementOptions {
  templateId?: PostItTemplateId;
  x: number;
  y: number;
  text?: string;
  appearance?: Partial<PostItAppearance>;
}

export function normalizePostItContent(input: unknown): PostItElementContent {
  const value = isRecord(input) ? input : {};
  const appearance = isRecord(value.appearance) ? value.appearance : {};
  const legacyText = typeof value.text === "string" ? value.text : "";

  return {
    kind: "post-it",
    text: legacyText,
    appearance: {
      ...DEFAULT_POST_IT_APPEARANCE,
      templateId: normalizeTemplateId(appearance.templateId),
      backgroundColor: normalizeHexColor(appearance.backgroundColor, DEFAULT_POST_IT_APPEARANCE.backgroundColor),
      patternColor: normalizeHexColor(appearance.patternColor, DEFAULT_POST_IT_APPEARANCE.patternColor),
      textColor: normalizeHexColor(appearance.textColor, DEFAULT_POST_IT_APPEARANCE.textColor),
      patternOpacity: normalizeOpacity(appearance.patternOpacity),
      preserveAspectRatio:
        typeof appearance.preserveAspectRatio === "boolean"
          ? appearance.preserveAspectRatio
          : DEFAULT_POST_IT_APPEARANCE.preserveAspectRatio,
    },
  };
}

export function createPostItElement({
  templateId = DEFAULT_POST_IT_APPEARANCE.templateId,
  x,
  y,
  text = "nota",
  appearance,
}: CreatePostItElementOptions): PageElement {
  const nextAppearance = {
    ...DEFAULT_POST_IT_APPEARANCE,
    ...appearance,
    templateId,
  };
  const size = getDefaultElementSize("post-it");

  return {
    id: createId("el"),
    type: "post-it",
    x,
    y,
    width: size.width,
    height: size.height,
    minWidth: 10,
    minHeight: 10,
    lockAspectRatio: nextAppearance.preserveAspectRatio,
    rotation: -2,
    zIndex: 10,
    locked: false,
    hidden: false,
    content: {
      kind: "post-it",
      text,
      appearance: nextAppearance,
    },
    style: {
      text: {
        fontSize: 12,
        fontWeight: 800,
        textAlign: "center",
      },
    },
  };
}

function normalizeTemplateId(value: unknown): PostItTemplateId {
  return typeof value === "string" && isAvailableTemplateId(value)
    ? value
    : DEFAULT_POST_IT_APPEARANCE.templateId;
}

function isAvailableTemplateId(value: string): value is PostItTemplateId {
  return AVAILABLE_POST_IT_TEMPLATE_IDS.some((templateId) => templateId === value);
}

function normalizeOpacity(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 1)
    : DEFAULT_POST_IT_APPEARANCE.patternOpacity;
}

function normalizeHexColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
