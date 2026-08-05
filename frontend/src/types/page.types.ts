import type { PageElement } from "./element.types";
import type { PaperType } from "./theme.types";

export interface Page {
  id: string;
  documentId: string;
  dividerId?: string;
  title?: string;
  order: number;

  paperType: PaperType;
  paperColor: string;

  patternColor?: string;
  patternOpacity?: number;
  patternSize?: number;

  elements: PageElement[];
  createdAt: string;
  updatedAt: string;
}