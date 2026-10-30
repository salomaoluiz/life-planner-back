// Spec 059 FR 1: notes are free text, trimmed at the ends; empty or whitespace-only means "no note".
export const NOTES_MAX = 1000;

export function normalizeNotes(value: null | string | undefined): null | string {
  const trimmed = value?.trim() ?? '';

  return trimmed.length > 0 ? trimmed : null;
}
