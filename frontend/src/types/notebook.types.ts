import type { Page } from "./page.types";

export const NOTEBOOK_SCHEMA_VERSION = 2;

export type NotebookBinding = "left" | "top";

export interface NotebookCover {
  color: string;
  borderColor: string;
  cornerRadius: number;
}

export interface NotebookDivider {
  id: string;
  color: string;
  tabColor: string;
  textColor: string;
  tabPosition: number;
}

export interface NotebookSection {
  id: string;
  title: string;
  divider: NotebookDivider;
  pages: Page[];
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
  Pick<NotebookDivider, "color" | "tabColor" | "textColor" | "tabPosition">
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
