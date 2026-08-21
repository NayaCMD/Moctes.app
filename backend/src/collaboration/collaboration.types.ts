export type CollaborationPathSegment = string | number | { id: string };

export type CollaborationPatch =
  | { op: 'set'; path: CollaborationPathSegment[]; value: unknown }
  | { op: 'delete'; path: CollaborationPathSegment[] }
  | {
      op: 'insert-entity';
      path: CollaborationPathSegment[];
      index: number;
      value: { id: string };
    }
  | { op: 'remove-entity'; path: CollaborationPathSegment[]; id: string }
  | { op: 'reorder-entities'; path: CollaborationPathSegment[]; ids: string[] };

export interface CollaborationOperationInput {
  operationId: string;
  clientId: string;
  baseSequence: number;
  patches: CollaborationPatch[];
}

export interface CollaborationCursor {
  pageId: string;
  x: number;
  y: number;
}
