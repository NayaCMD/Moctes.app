import type { DocumentType } from "./document.types";
import type { PageElement } from "./element.types";
import type { PaperAppearance } from "./page.types";

export type PageTemplateId =
  | "diary"
  | "daily-planner"
  | "studies"
  | "moodboard"
  | "checklist"
  | "weekly"
  | "monthly"
  | "project"
  | "blank";

export interface PageTemplateDefinition {
  id: PageTemplateId;
  name: string;
  description: string;
  category: "reflection" | "planning" | "creative" | "productivity" | "basic";
  recommendedFor: DocumentType[];
}

export interface InstantiatedPageTemplate {
  definition: PageTemplateDefinition;
  title: string;
  appearance: PaperAppearance;
  elements: PageElement[];
}

export interface CreatePageFromTemplateOptions {
  templateId: PageTemplateId;
  documentId?: string;
  sectionId?: string;
}
