import { isWithinUndoWindow, UNDO_WINDOW_MS } from './index';

describe('isWithinUndoWindow', () => {
  const created = new Date('2026-11-18T10:00:00.000Z');

  it('SHOULD allow undo up to 10 minutes after the gesture', () => {
    expect(UNDO_WINDOW_MS).toBe(600_000);
    expect(isWithinUndoWindow(created, new Date(created.getTime() + UNDO_WINDOW_MS))).toBe(true);
  });

  it('SHOULD refuse once the window passed', () => {
    expect(isWithinUndoWindow(created, new Date(created.getTime() + UNDO_WINDOW_MS + 1))).toBe(
      false,
    );
  });
});
