import type { AssetCategory, AssetSource, AssetType } from "./asset.types";
import type {
  NotebookBinding,
  NotebookCover,
  NotebookSection,
} from "./notebook.types";
import type { Page } from "./page.types";

export type { AssetCategory } from "./asset.types";

export type DocumentType = "notebook" | "notepad" | "clipboard";

export type TopTab =
  | "favorites"
  | "files"
  | "current-note"
  | "calendar"
  | "user"
  | "settings";

export interface Divider {
  id: string;
  documentId: string;
  name: string;
  color: string;
  order: number;
}

export interface MoctesDocument {
  schemaVersion?: 1 | 2;
  id: string;
  type: DocumentType;
  title: string;
  cover?: NotebookCover;
  binding?: NotebookBinding;
  sections?: NotebookSection[];
  activeSurfaceId?: string;
  coverColor: string;
  coverBorderColor?: string;
  spineColor?: string;
  leftTabColor?: string;
  rightTabColor?: string;
  dividerColor?: string;
  clipboardColor?: string;
  favorite: boolean;
  pages: Page[];
  dividers: Divider[];
  activePageId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SidebarAsset {
  id: string;
  category: AssetCategory;
  type?: AssetType;
  label: string;
  src: string;
  source?: AssetSource;
  mimeType?: string;
  size?: number;
}
