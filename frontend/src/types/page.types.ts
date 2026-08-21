import type { PageElement } from "./element.types";
import type { PaperType } from "./theme.types";

export type PaperTexture = "none" | "grain" | "fiber" | "recycled";

export interface PaperMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
  visible: boolean;
}

export interface PaperAppearance {
  paperType: PaperType;
  paperColor: string;
  patternColor: string;
  patternOpacity: number;
  patternSize: number;
  paperTexture: PaperTexture;
  textureIntensity: number;
  margins: PaperMargins;
}

export interface PaperAppearanceTemplate {
  id: string;
  name: string;
  appearance: PaperAppearance;
  createdAt: string;
}

export interface Page {
  id: string;
  documentId: string;
  sectionId?: string;
  /** @deprecated Kept only while migrating notebook schemas V1/V2. */
  dividerId?: string;
  title?: string;
  order: number;

  paperType: PaperType;
  paperColor: string;

  patternColor?: string;
  patternOpacity?: number;
  patternSize?: number;
  paperTexture?: PaperTexture;
  textureIntensity?: number;
  margins?: PaperMargins;

  elements: PageElement[];
  createdAt: string;
  updatedAt: string;
}
