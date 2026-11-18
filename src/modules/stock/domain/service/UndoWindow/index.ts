// Spec 117 FR 8: covers offline sends; the UI notice lasts 6 s.
export const UNDO_WINDOW_MS = 600_000;

export function isWithinUndoWindow(gestureCreatedAt: Date, now: Date): boolean {
  return now.getTime() - gestureCreatedAt.getTime() <= UNDO_WINDOW_MS;
}
