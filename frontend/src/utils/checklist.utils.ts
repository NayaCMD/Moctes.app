import type {
  ChecklistAppearance,
  ChecklistElementContent,
  ChecklistItem,
  PageElement,
  TextElementContent,
} from "../types/element.types";
import { getElementSizing } from "./elementSizing.utils";

export const DEFAULT_CHECKLIST_APPEARANCE: ChecklistAppearance = {
  accentColor: "#8da3ed",
  textColor: "#26324a",
  completedColor: "#71809b",
  backgroundColor: "#ffffff",
  markerStyle: "circle",
  surfaceStyle: "transparent",
};

export function createChecklistElement(options: {
  x?: number;
  y?: number;
  title?: string;
  items?: Array<Partial<ChecklistItem> & { text: string }>;
  appearance?: Partial<ChecklistAppearance>;
} = {}): PageElement {
  const size = getElementSizing("checklist");
  const content = createChecklistContent({
    title: options.title,
    items: options.items,
    appearance: options.appearance,
  });

  return {
    id: `el-${crypto.randomUUID()}`,
    type: "checklist",
    x: options.x ?? 36,
    y: options.y ?? 34,
    width: size.defaultWidth,
    height: size.defaultHeight,
    minWidth: size.minWidth,
    minHeight: size.minHeight,
    lockAspectRatio: false,
    rotation: 0,
    zIndex: 10,
    locked: false,
    hidden: false,
    content,
    style: {},
  };
}

export function createChecklistContent(options: {
  title?: string;
  items?: Array<Partial<ChecklistItem> & { text: string }>;
  appearance?: Partial<ChecklistAppearance>;
} = {}): ChecklistElementContent {
  const sourceItems = options.items?.length
    ? options.items
    : [{ text: "Nova tarefa", completed: false }];
  return {
    kind: "checklist",
    title: options.title ?? "Lista de tarefas",
    items: sourceItems.map((item) => ({
      id: item.id || `check-${crypto.randomUUID()}`,
      text: item.text,
      completed: Boolean(item.completed),
    })),
    appearance: { ...DEFAULT_CHECKLIST_APPEARANCE, ...options.appearance },
  };
}

export function normalizeChecklistContent(
  input: ChecklistElementContent,
): ChecklistElementContent {
  const rawItems = Array.isArray(input.items) ? input.items : [];
  return {
    kind: "checklist",
    title: typeof input.title === "string" ? input.title : "Lista de tarefas",
    items: rawItems.map((item, index) => ({
      id:
        typeof item?.id === "string" && item.id
          ? item.id
          : `check-${index}-${crypto.randomUUID()}`,
      text: typeof item?.text === "string" ? item.text : "",
      completed: Boolean(item?.completed),
    })),
    appearance: normalizeChecklistAppearance(input.appearance),
  };
}

export function textToChecklistContent(
  content: TextElementContent,
): ChecklistElementContent {
  const items = content.text
    .split(/\r?\n/)
    .map(parseChecklistLine)
    .filter((item): item is { text: string; completed: boolean } => Boolean(item));
  return createChecklistContent({
    title: "",
    items: items.length ? items : [{ text: content.text.trim() || "Nova tarefa" }],
  });
}

export function checklistToText(content: ChecklistElementContent): string {
  const title = content.title.trim();
  const lines = content.items.map(
    (item) => `- [${item.completed ? "x" : " "}] ${item.text}`,
  );
  return [title, ...lines].filter(Boolean).join("\n");
}

export function moveChecklistItem(
  items: ChecklistItem[],
  itemId: string,
  targetIndex: number,
): ChecklistItem[] {
  const sourceIndex = items.findIndex((item) => item.id === itemId);
  if (sourceIndex < 0) return items;
  const next = [...items];
  const [item] = next.splice(sourceIndex, 1);
  next.splice(Math.max(0, Math.min(targetIndex, next.length)), 0, item);
  return next;
}

function normalizeChecklistAppearance(input: unknown): ChecklistAppearance {
  const appearance =
    typeof input === "object" && input !== null
      ? (input as Partial<ChecklistAppearance>)
      : {};
  return {
    accentColor: validColor(appearance.accentColor, DEFAULT_CHECKLIST_APPEARANCE.accentColor),
    textColor: validColor(appearance.textColor, DEFAULT_CHECKLIST_APPEARANCE.textColor),
    completedColor: validColor(
      appearance.completedColor,
      DEFAULT_CHECKLIST_APPEARANCE.completedColor,
    ),
    backgroundColor: validColor(
      appearance.backgroundColor,
      DEFAULT_CHECKLIST_APPEARANCE.backgroundColor,
    ),
    markerStyle: appearance.markerStyle === "square" ? "square" : "circle",
    surfaceStyle:
      appearance.surfaceStyle === "paper" || appearance.surfaceStyle === "highlight"
        ? appearance.surfaceStyle
        : "transparent",
  };
}

function parseChecklistLine(line: string): { text: string; completed: boolean } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const taskMatch = trimmed.match(/^[-*•]?\s*\[([xX ])\]\s*(.*)$/);
  if (taskMatch) {
    return { completed: taskMatch[1].toLowerCase() === "x", text: taskMatch[2] };
  }
  return {
    completed: false,
    text: trimmed.replace(/^[-*•]\s+/, ""),
  };
}

function validColor(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}
