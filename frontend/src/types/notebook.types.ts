import type { Page } from "./page.types";

export const NOTEBOOK_SCHEMA_VERSION = 3;

export type NotebookBinding = "left" | "top";
export type NotebookMaterial = "smooth" | "linen" | "speckled";

export interface NotebookCover {
  color: string;
  borderColor: string;
  cornerRadius: number;
  material?: NotebookMaterial;
  textureIntensity?: number;
}

export interface NotebookDivider {
  id: string;
  color: string;
  tabColor: string;
  textColor: string;
  tabPosition: number;
  material?: NotebookMaterial;
  textureIntensity?: number;
}

export interface NotebookSection {
  id: string;
  title: string;
  divider: NotebookDivider;
}

export interface AddNotebookSectionOptions {
  title?: string;
  color?: string;
  createInitialPage?: boolean;
  index?: number;
}

export type RemoveSectionStrategy =
  | {
      mode: "delete-pages";
    }
  | {
      mode: "move-pages";
      targetSectionId: string;
    };

export type NotebookDividerUpdate = Partial<
  Pick<
    NotebookDivider,
    "color" | "tabColor" | "textColor" | "tabPosition" | "material" | "textureIntensity"
  >
> & {
  title?: string;
};

export type NotebookSurface =
  | {
      kind: "divider";
      id: string;
      sectionId: string;
      divider: NotebookDivider;
    }
  | {
      kind: "page";
      id: string;
      sectionId: string;
      page: Page;
    };

export type NotebookTransitionDirection = "forward" | "backward";

export type NotebookTransitionPhase = "preparing" | "running";

export interface NotebookTransitionState {
  documentId: string;
  fromSurfaceId: string;
  toSurfaceId: string;
  direction: NotebookTransitionDirection;
  phase: NotebookTransitionPhase;
}

export type NotebookBookPhase = "closed" | "opening" | "open" | "closing";

export interface NotebookBookState {
  documentId: string;
  phase: NotebookBookPhase;
}
