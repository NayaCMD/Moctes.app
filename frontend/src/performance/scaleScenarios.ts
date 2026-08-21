import type { MoctesDocument } from "../types/document.types";
import type { PageElement } from "../types/element.types";
import type { Page } from "../types/page.types";

const FIXED_TIMESTAMP = "2026-01-15T12:00:00.000Z";
const IMAGE_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='72' viewBox='0 0 96 72'%3E%3Crect width='96' height='72' rx='8' fill='%23dce7ff'/%3E%3Ccircle cx='28' cy='25' r='10' fill='%238da3ed'/%3E%3Cpath d='M8 64 37 38l17 16 13-12 21 22Z' fill='%236f85d6'/%3E%3C/svg%3E";

export type ScaleProfileName = "large" | "extreme";

export interface ScaleScenarioConfig {
  seed: number;
  pageCount: number;
  activePageElements: number;
  elementsPerOtherPage: number;
  imageRatio: number;
  imageAssetPoolSize: number;
  offlineQueueLength: number;
  conflictCycles: number;
}

export interface ScaleScenarioSummary {
  pages: number;
  elements: number;
  activePageElements: number;
  imageElements: number;
  distinctImageAssets: number;
  offlineQueueOperations: number;
  conflictCycles: number;
}

export interface ScaleScenario {
  profile: ScaleProfileName;
  config: ScaleScenarioConfig;
  document: MoctesDocument;
  queueDocuments: MoctesDocument[];
  summary: ScaleScenarioSummary;
}

export const SCALE_PROFILES: Record<ScaleProfileName, ScaleScenarioConfig> = {
  large: {
    seed: 20_260_815,
    pageCount: 300,
    activePageElements: 700,
    elementsPerOtherPage: 16,
    imageRatio: 0.3,
    imageAssetPoolSize: 240,
    offlineQueueLength: 500,
    conflictCycles: 250,
  },
  extreme: {
    seed: 20_260_816,
    pageCount: 500,
    activePageElements: 1_200,
    elementsPerOtherPage: 22,
    imageRatio: 0.34,
    imageAssetPoolSize: 500,
    offlineQueueLength: 1_500,
    conflictCycles: 1_000,
  },
};

export function createScaleScenario(
  profile: ScaleProfileName,
  overrides: Partial<ScaleScenarioConfig> = {},
): ScaleScenario {
  const config = { ...SCALE_PROFILES[profile], ...overrides };
  validateConfig(config);
  const random = createSeededRandom(config.seed);
  const documentId = `performance-${profile}-${config.seed}`;
  let globalElementIndex = 0;
  let imageElements = 0;

  const pages = Array.from({ length: config.pageCount }, (_, pageIndex) => {
    const elementCount =
      pageIndex === 0
        ? config.activePageElements
        : config.elementsPerOtherPage;
    const elements = Array.from({ length: elementCount }, () => {
      const element = createElement({
        index: globalElementIndex,
        pageIndex,
        random,
        config,
      });
      globalElementIndex += 1;
      if (element.type === "image") {
        imageElements += 1;
      }
      return element;
    });
    return createPage(documentId, pageIndex, elements);
  });

  const document: MoctesDocument = {
    schemaVersion: 3,
    id: documentId,
    type: "notepad",
    title: `Cenario ${profile} de performance`,
    coverColor: "#cbd8f7",
    favorite: false,
    pages,
    dividers: [],
    activePageId: pages[0].id,
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
  };

  const queueDocuments = Array.from(
    { length: config.offlineQueueLength },
    (_, index) => createQueueDocument(profile, config.seed, index),
  );

  return {
    profile,
    config,
    document,
    queueDocuments,
    summary: {
      pages: pages.length,
      elements: globalElementIndex,
      activePageElements: pages[0].elements.length,
      imageElements,
      distinctImageAssets: Math.min(config.imageAssetPoolSize, imageElements),
      offlineQueueOperations: queueDocuments.length,
      conflictCycles: config.conflictCycles,
    },
  };
}

function createElement(options: {
  index: number;
  pageIndex: number;
  random: () => number;
  config: ScaleScenarioConfig;
}): PageElement {
  const { index, pageIndex, random, config } = options;
  const isFirst = index === 0;
  const isImage = !isFirst && random() < config.imageRatio;
  const column = index % 10;
  const row = Math.floor(index / 10) % 18;
  const x = 2.5 + column * 9.4 + random() * 0.8;
  const y = 2.5 + row * 5.25 + random() * 0.6;
  const width = isImage ? 8.2 : 7.3;
  const height = isImage ? 5.4 : 4.2;
  const common = {
    id: `perf-el-${pageIndex}-${index}`,
    x,
    y,
    width,
    height,
    rotation: (random() - 0.5) * 4,
    zIndex: index + 1,
    locked: false,
    hidden: false,
    minWidth: 2,
    minHeight: 2,
  };

  if (isImage) {
    return {
      ...common,
      type: "image",
      lockAspectRatio: true,
      content: {
        kind: "image",
        // Data-URI fixtures are self-contained and intentionally have no remote
        // asset id, so the lab measures rendering instead of failed API lookups.
        assetId: "",
        src: IMAGE_DATA_URI,
        alt: `Imagem de teste ${index}`,
      },
      style: {
        image: {
          objectFit: "cover",
          borderRadius: 6,
          opacity: 0.94,
        },
      },
    };
  }

  if (isFirst || index % 3 === 0) {
    const fillColors = ["#dce7ff", "#f9dddc", "#dcefe4", "#f8ecc8"];
    return {
      ...common,
      type: "shape",
      content: {
        kind: "shape",
        shape: isFirst ? "rounded-rectangle" : "rectangle",
        label: isFirst ? "Arraste e redimensione" : undefined,
        appearance: {
          shapeType: isFirst ? "rounded-rectangle" : "rectangle",
          fillColor: fillColors[index % fillColors.length],
          strokeColor: "#7890cf",
          strokeWidth: 1,
          opacity: 0.9,
          preserveAspectRatio: false,
        },
      },
      style: {
        text: {
          color: "#31415f",
          fontSize: 11,
          textAlign: "center",
        },
      },
    };
  }

  return {
    ...common,
    type: "text",
    content: {
      kind: "text",
      text: `P${pageIndex + 1} E${index + 1}`,
    },
    style: {
      text: {
        color: "#34405d",
        fontSize: 11 + (index % 3),
        lineHeight: 1.25,
      },
    },
  };
}

function createPage(
  documentId: string,
  pageIndex: number,
  elements: PageElement[],
): Page {
  return {
    id: `${documentId}-page-${pageIndex}`,
    documentId,
    title: `Pagina ${pageIndex + 1}`,
    order: pageIndex,
    paperType: pageIndex % 2 === 0 ? "dotted" : "grid",
    paperColor: "#fffdf8",
    patternColor: "#9aaed8",
    patternOpacity: 12,
    patternSize: 18,
    elements,
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
  };
}

function createQueueDocument(
  profile: ScaleProfileName,
  seed: number,
  index: number,
): MoctesDocument {
  const documentId = `performance-queue-${profile}-${seed}-${index}`;
  const page = createPage(documentId, 0, [
    {
      id: `${documentId}-element`,
      type: "text",
      x: 8,
      y: 8,
      width: 30,
      height: 8,
      rotation: 0,
      zIndex: 1,
      locked: false,
      hidden: false,
      content: { kind: "text", text: `Operacao offline ${index + 1}` },
      style: { text: { fontSize: 14, color: "#34405d" } },
    },
  ]);
  return {
    schemaVersion: 3,
    id: documentId,
    type: "notepad",
    title: `Documento offline ${index + 1}`,
    coverColor: "#dce7ff",
    favorite: false,
    pages: [page],
    dividers: [],
    activePageId: page.id,
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
  };
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function validateConfig(config: ScaleScenarioConfig): void {
  const integerFields: Array<keyof ScaleScenarioConfig> = [
    "pageCount",
    "activePageElements",
    "elementsPerOtherPage",
    "imageAssetPoolSize",
    "offlineQueueLength",
    "conflictCycles",
  ];
  for (const field of integerFields) {
    if (!Number.isInteger(config[field]) || config[field] < 1) {
      throw new Error(`${field} precisa ser um inteiro positivo.`);
    }
  }
  if (config.imageRatio < 0 || config.imageRatio > 1) {
    throw new Error("imageRatio precisa estar entre 0 e 1.");
  }
}
