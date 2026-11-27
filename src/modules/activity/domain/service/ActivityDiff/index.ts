export interface ActivityChange {
  field: string;
  from: unknown;
  to: unknown;
}

function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// Spec 127 FR 7: only the listed (user-editable) fields whose value really changed, in the order of `fields`.
export function buildChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[],
): ActivityChange[] {
  return fields
    .filter((field) => !equal(before[field], after[field]))
    .map((field) => ({ field, from: before[field] ?? null, to: after[field] ?? null }));
}
