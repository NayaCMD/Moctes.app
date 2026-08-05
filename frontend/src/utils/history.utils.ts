import type { MoctesDocument } from "../types/document.types";

export const HISTORY_LIMIT = 50;

export function cloneDocuments(documents: MoctesDocument[]): MoctesDocument[] {
  return structuredClone(documents);
}

export function pushHistorySnapshot(
  stack: MoctesDocument[][],
  documents: MoctesDocument[],
): MoctesDocument[][] {
  return [...stack, cloneDocuments(documents)].slice(-HISTORY_LIMIT);
}
