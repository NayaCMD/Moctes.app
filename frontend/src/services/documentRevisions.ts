import { apiGet, type ApiResponse } from "./apiClient";
import type { MoctesDocument } from "../types/document.types";

export interface DocumentRevisionSummary {
  id: string;
  version: number;
  title: string;
  schemaVersion: number;
  restoredFromVersion: number | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
}

export interface DocumentRevisionList {
  documentId: string;
  currentVersion: number;
  revisions: DocumentRevisionSummary[];
}

export interface DocumentRevision extends DocumentRevisionSummary {
  documentId: string;
  document: MoctesDocument;
}

export function listDocumentRevisions(
  documentId: string,
): Promise<ApiResponse<DocumentRevisionList>> {
  return apiGet<DocumentRevisionList>(
    `/documents/${encodeURIComponent(documentId)}/revisions`,
  );
}

export function getDocumentRevision(
  documentId: string,
  version: number,
): Promise<ApiResponse<DocumentRevision>> {
  return apiGet<DocumentRevision>(
    `/documents/${encodeURIComponent(documentId)}/revisions/${version}`,
  );
}
