export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    Boolean(target.isContentEditable) ||
    target.getAttribute("contenteditable") === "true"
  );
}

export function isModKey(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey;
}
