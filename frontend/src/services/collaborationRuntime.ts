const managedDocumentIds = new Set<string>();

export function setRealtimeManaged(documentId: string, managed: boolean): void {
  if (managed) managedDocumentIds.add(documentId);
  else managedDocumentIds.delete(documentId);
}

export function isRealtimeManaged(documentId: string): boolean {
  return managedDocumentIds.has(documentId);
}

export function clearRealtimeManagedDocuments(): void {
  managedDocumentIds.clear();
}
