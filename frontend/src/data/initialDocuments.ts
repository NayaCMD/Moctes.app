import { assetCatalog } from "./assetCatalog";
import type { MoctesDocument } from "../types/document.types";
import type { PageElement } from "../types/element.types";
import { DEFAULT_POST_IT_APPEARANCE } from "../utils/postIt.utils";
import { createShapeAppearance } from "../utils/shape.utils";

const now = "2026-07-21T00:00:00.000Z";

function textElement(
  id: string,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: number | string;
    color?: string;
    rotation?: number;
    zIndex?: number;
    lineHeight?: number;
  } = {},
): PageElement {
  return {
    id,
    type: "text",
    x,
    y,
    width,
    height,
    rotation: options.rotation ?? 0,
    zIndex: options.zIndex ?? 1,
    locked: false,
    hidden: false,
    content: { kind: "text", text },
    style: {
      text: {
        color: options.color ?? "#26324a",
        fontSize: options.fontSize ?? 14,
        fontFamily: options.fontFamily,
        fontWeight: options.fontWeight,
        lineHeight: options.lineHeight ?? 1.45,
      },
    },
  };
}

function assetElement(
  id: string,
  type: "image" | "sticker" | "tape" | "post-it",
  asset: (typeof assetCatalog)[keyof typeof assetCatalog],
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    text?: string;
    rotation?: number;
    zIndex?: number;
    objectFit?: "cover" | "contain";
  } = {},
): PageElement {
  const base = {
    id,
    type,
    x,
    y,
    width,
    height,
    rotation: options.rotation ?? 0,
    zIndex: options.zIndex ?? 1,
    locked: false,
    hidden: false,
    style: {
      image: {
        objectFit: options.objectFit ?? "cover",
        borderRadius: 4,
        boxShadow: type === "tape" ? undefined : "0 8px 14px rgba(71,83,113,0.14)",
      },
    },
  };

  if (type === "post-it") {
    return {
      ...base,
      lockAspectRatio: DEFAULT_POST_IT_APPEARANCE.preserveAspectRatio,
      content: {
        kind: "post-it",
        text: options.text ?? "",
        appearance: DEFAULT_POST_IT_APPEARANCE,
      },
      style: {
        text: {
          color: DEFAULT_POST_IT_APPEARANCE.textColor,
          fontSize: 12,
          fontWeight: 800,
          textAlign: "center",
        },
      },
    };
  }

  return {
    ...base,
    content: {
      kind: type,
      assetId: asset.id,
      src: asset.src,
      alt: asset.label,
    },
  };
}

function stickerBubble(
  id: string,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation = -5,
): PageElement {
  return {
    id,
    type: "shape",
    x,
    y,
    width,
    height,
    rotation,
    zIndex: 3,
    locked: false,
    hidden: false,
    content: {
      kind: "shape",
      shape: "rounded-rectangle",
      label: text,
      appearance: createShapeAppearance("rounded-rectangle", {
        fillColor: "#cbe58d",
        strokeColor: "rgba(80,91,112,0.42)",
        strokeWidth: 2,
      }),
    },
    style: {
      box: {
        backgroundColor: "#cbe58d",
        borderColor: "rgba(80,91,112,0.42)",
        borderWidth: 2,
        borderRadius: 42,
        boxShadow: "0 8px 14px rgba(78,86,112,0.15)",
      },
      text: {
        textAlign: "center",
        color: "#40544f",
        fontFamily: '"Segoe Print", "Comic Sans MS", cursive',
        fontWeight: 900,
        fontSize: 18,
      },
    },
  };
}

export const initialDocuments: MoctesDocument[] = [
  {
    id: "doc-notebook-demo",
    type: "notebook",
    title: "July Journal",
    coverColor: "#bde4eb",
    dividerColor: "#d9f4f7",
    favorite: false,
    activePageId: "page-notebook-left",
    createdAt: now,
    updatedAt: now,
    dividers: [
      {
        id: "divider-notebook-july",
        documentId: "doc-notebook-demo",
        name: "July",
        color: "#cfeef4",
        order: 1,
      },
    ],
    pages: [
      {
        id: "page-notebook-left",
        documentId: "doc-notebook-demo",
        dividerId: "divider-notebook-july",
        title: "Dear diary",
        order: 1,
        paperType: "dotted",
        paperColor: "#fffdf8",
        createdAt: now,
        updatedAt: now,
        elements: [
          assetElement("el-left-tape", "tape", assetCatalog.tapeGreen, 8, 4, 84, 8, {
            zIndex: 1,
          }),
          textElement("el-left-title", "Dear diary", 8, 11, 38, 11, {
            fontSize: 30,
            fontFamily: '"Segoe Print", "Comic Sans MS", cursive',
            fontWeight: 800,
            color: "#7591f0",
            zIndex: 2,
          }),
          textElement(
            "el-left-journal",
            "Hoje o dia começou leve.\nCafé, música baixa e céu claro.\nGuardei uma flor entre as páginas.\nQuero lembrar desse azul calmo.\nPequenas coisas também contam.",
            8,
            27,
            47,
            35,
            { fontSize: 13, lineHeight: 1.65 },
          ),
          assetElement(
            "el-left-image",
            "image",
            assetCatalog.cadernoCores,
            60,
            24,
            27,
            18,
            { rotation: 3, zIndex: 2 },
          ),
          assetElement("el-left-note-image", "post-it", assetCatalog.paperNote, 42, 74, 21, 14, {
            rotation: -4,
            zIndex: 2,
          }),
          textElement("el-left-note", "meu cantinho favorito", 12, 78, 45, 9, {
            fontSize: 12,
            fontWeight: 800,
            color: "#5d79df",
            zIndex: 3,
          }),
          stickerBubble("el-left-calm", "calm", 69, 76, 22, 13),
        ],
      },
      {
        id: "page-notebook-right",
        documentId: "doc-notebook-demo",
        dividerId: "divider-notebook-july",
        title: "July",
        order: 2,
        paperType: "dotted",
        paperColor: "#fffdf8",
        createdAt: now,
        updatedAt: now,
        elements: [
          textElement("el-right-month", "July", 68, 8, 24, 14, {
            fontSize: 46,
            fontFamily: '"Segoe Print", "Comic Sans MS", cursive',
            fontWeight: 800,
            color: "rgba(147,165,244,0.86)",
          }),
          textElement("el-right-label", "today:", 9, 27, 19, 7, {
            fontSize: 14,
            fontWeight: 800,
            color: "#6b7ddb",
          }),
          textElement(
            "el-right-list",
            "◉ regar as plantas\n◉ escrever uma página\n○ separar fotos\n○ descansar cedo",
            9,
            36,
            52,
            24,
            { fontSize: 13, lineHeight: 1.75 },
          ),
          textElement(
            "el-right-phrase",
            "a soft afternoon, a tiny list,\nand a little space to breathe.",
            9,
            67,
            60,
            13,
            {
              fontSize: 14,
              fontWeight: 900,
              color: "#6382f0",
              lineHeight: 1.3,
            },
          ),
          stickerBubble("el-right-tea", "tea", 68, 78, 20, 12, -6),
        ],
      },
    ],
  },
  {
    id: "doc-notepad-demo",
    type: "notepad",
    title: "Little Notes",
    coverColor: "#bde4eb",
    favorite: false,
    activePageId: "page-notepad-1",
    createdAt: now,
    updatedAt: now,
    dividers: [],
    pages: [
      {
        id: "page-notepad-1",
        documentId: "doc-notepad-demo",
        title: "little notes",
        order: 1,
        paperType: "dotted",
        paperColor: "#fffdf8",
        createdAt: now,
        updatedAt: now,
        elements: [
          assetElement("el-notepad-tape", "tape", assetCatalog.tapeGreen, 9, 4, 82, 8),
          textElement("el-notepad-title", "little\nnotes", 17, 20, 40, 18, {
            fontSize: 31,
            fontFamily: '"Segoe Print", "Comic Sans MS", cursive',
            fontWeight: 800,
            color: "#7591f0",
            lineHeight: 1.05,
          }),
          textElement(
            "el-notepad-lines",
            "Hoje o dia\ncomeçou leve.\n\nCafé, música\nbaixa e céu claro.\n\nGuardei uma flor\nentre as páginas.\n\nQuero lembrar\ndesse azul calmo.",
            17,
            43,
            46,
            45,
            { fontSize: 13, lineHeight: 1.45 },
          ),
          stickerBubble("el-notepad-remember", "remember", 52, 30, 34, 13, -5),
        ],
      },
    ],
  },
  {
    id: "doc-clipboard-demo",
    type: "clipboard",
    title: "Weekend List",
    coverColor: "#c8b4e6",
    clipboardColor: "#c8b4e6",
    favorite: false,
    activePageId: "page-clipboard-1",
    createdAt: now,
    updatedAt: now,
    dividers: [],
    pages: [
      {
        id: "page-clipboard-1",
        documentId: "doc-clipboard-demo",
        title: "weekend list",
        order: 1,
        paperType: "dotted",
        paperColor: "#f7fcff",
        createdAt: now,
        updatedAt: now,
        elements: [
          textElement("el-clipboard-title", "weekend\nlist", 18, 18, 50, 20, {
            fontSize: 32,
            fontFamily: '"Segoe Print", "Comic Sans MS", cursive',
            fontWeight: 800,
            color: "#7591f0",
            lineHeight: 1.05,
          }),
          textElement(
            "el-clipboard-lines",
            "Hoje o dia\ncomeçou leve.\n\nCafé, música\nbaixa e céu claro.\n\nGuardei uma flor\nentre as páginas.",
            18,
            44,
            56,
            42,
            { fontSize: 13, lineHeight: 1.45 },
          ),
        ],
      },
    ],
  },
];
