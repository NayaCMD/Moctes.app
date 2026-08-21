import type {
  Page,
  PaperAppearance,
  PaperAppearanceTemplate,
  PaperMargins,
  PaperTexture,
} from "../types/page.types";
import type { PaperType } from "../types/theme.types";

export const DEFAULT_PAPER_MARGINS: PaperMargins = {
  top: 7,
  right: 7,
  bottom: 7,
  left: 7,
  visible: false,
};

export const DEFAULT_PAPER_APPEARANCE: PaperAppearance = {
  paperType: "dotted",
  paperColor: "#fffdf8",
  patternColor: "#72a0b9",
  patternOpacity: 14,
  patternSize: 18,
  paperTexture: "none",
  textureIntensity: 16,
  margins: DEFAULT_PAPER_MARGINS,
};

export interface BuiltInPaperPreset {
  id: string;
  name: string;
  description: string;
  appearance: PaperAppearance;
}

export const BUILT_IN_PAPER_PRESETS: BuiltInPaperPreset[] = [
  {
    id: "journal-dotted",
    name: "Diário",
    description: "Pontilhado suave",
    appearance: DEFAULT_PAPER_APPEARANCE,
  },
  {
    id: "classic-lined",
    name: "Clássico",
    description: "Pautado com margem",
    appearance: {
      ...DEFAULT_PAPER_APPEARANCE,
      paperType: "lined",
      paperColor: "#fffaf0",
      patternColor: "#7893ad",
      patternOpacity: 18,
      patternSize: 25,
      paperTexture: "fiber",
      margins: { ...DEFAULT_PAPER_MARGINS, left: 12, visible: true },
    },
  },
  {
    id: "studio-grid",
    name: "Estúdio",
    description: "Grade precisa",
    appearance: {
      ...DEFAULT_PAPER_APPEARANCE,
      paperType: "grid",
      paperColor: "#f8fbff",
      patternColor: "#7894bc",
      patternOpacity: 13,
      patternSize: 22,
      paperTexture: "grain",
      textureIntensity: 10,
    },
  },
  {
    id: "warm-blank",
    name: "Livre",
    description: "Papel branco texturizado",
    appearance: {
      ...DEFAULT_PAPER_APPEARANCE,
      paperType: "blank",
      paperColor: "#fcf2e7",
      patternOpacity: 0,
      patternSize: 22,
      paperTexture: "recycled",
      textureIntensity: 18,
    },
  },
];

export function getDefaultPatternSize(paperType: PaperType): number {
  if (paperType === "dotted") return 18;
  if (paperType === "lined") return 25;
  return 22;
}

export function normalizePaperAppearance(
  input: Partial<PaperAppearance> | null | undefined,
  fallback: PaperAppearance = DEFAULT_PAPER_APPEARANCE,
): PaperAppearance {
  const paperType = normalizePaperType(input?.paperType, fallback.paperType);
  return {
    paperType,
    paperColor: normalizeColor(input?.paperColor, fallback.paperColor),
    patternColor: normalizeColor(input?.patternColor, fallback.patternColor),
    patternOpacity: clamp(input?.patternOpacity, 0, 60, fallback.patternOpacity),
    patternSize: clamp(
      input?.patternSize,
      8,
      48,
      input?.paperType ? getDefaultPatternSize(paperType) : fallback.patternSize,
    ),
    paperTexture: normalizeTexture(input?.paperTexture, fallback.paperTexture),
    textureIntensity: clamp(input?.textureIntensity, 0, 50, fallback.textureIntensity),
    margins: normalizeMargins(input?.margins, fallback.margins),
  };
}

export function getPageAppearance(page: Page): PaperAppearance {
  return normalizePaperAppearance({
    paperType: page.paperType,
    paperColor: page.paperColor,
    patternColor: page.patternColor,
    patternOpacity: page.patternOpacity,
    patternSize: page.patternSize,
    paperTexture: page.paperTexture,
    textureIntensity: page.textureIntensity,
    margins: page.margins,
  });
}

export function applyPaperAppearance(page: Page, appearance: PaperAppearance): Page {
  const normalized = normalizePaperAppearance(appearance);
  return {
    ...page,
    ...normalized,
    margins: { ...normalized.margins },
  };
}

export function normalizePaperTemplate(input: PaperAppearanceTemplate): PaperAppearanceTemplate {
  return {
    id: typeof input.id === "string" && input.id ? input.id : `paper-template-${crypto.randomUUID()}`,
    name: typeof input.name === "string" && input.name.trim() ? input.name.trim().slice(0, 48) : "Sem nome",
    appearance: normalizePaperAppearance(input.appearance),
    createdAt: typeof input.createdAt === "string" ? input.createdAt : new Date().toISOString(),
  };
}

function normalizeMargins(
  input: Partial<PaperMargins> | null | undefined,
  fallback: PaperMargins,
): PaperMargins {
  return {
    top: clamp(input?.top, 0, 24, fallback.top),
    right: clamp(input?.right, 0, 24, fallback.right),
    bottom: clamp(input?.bottom, 0, 24, fallback.bottom),
    left: clamp(input?.left, 0, 24, fallback.left),
    visible: typeof input?.visible === "boolean" ? input.visible : fallback.visible,
  };
}

function normalizePaperType(value: unknown, fallback: PaperType): PaperType {
  return value === "blank" || value === "lined" || value === "grid" || value === "dotted"
    ? value
    : fallback;
}

function normalizeTexture(value: unknown, fallback: PaperTexture): PaperTexture {
  return value === "none" || value === "grain" || value === "fiber" || value === "recycled"
    ? value
    : fallback;
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}
