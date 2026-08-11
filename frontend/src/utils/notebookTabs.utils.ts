export const NOTEBOOK_TAB_MIN_POSITION = 0;
export const NOTEBOOK_TAB_MAX_POSITION = 84;
export const NOTEBOOK_TAB_KEYBOARD_STEP = 4;
export const NOTEBOOK_TAB_KEYBOARD_LARGE_STEP = 12;
export const NOTEBOOK_TAB_DRAG_THRESHOLD_PX = 4;

export function clampNotebookTabPosition(position: number): number {
  if (!Number.isFinite(position)) {
    return NOTEBOOK_TAB_MIN_POSITION;
  }

  return Math.min(NOTEBOOK_TAB_MAX_POSITION, Math.max(NOTEBOOK_TAB_MIN_POSITION, position));
}
