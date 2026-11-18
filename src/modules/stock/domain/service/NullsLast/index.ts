// Ascending order where a missing value goes after every present one (no date sorts last).
export function compareNullsLast(a: number | undefined, b: number | undefined): number {
  if (a !== undefined && b !== undefined) {
    return a - b;
  }

  if (a === undefined && b === undefined) {
    return 0;
  }

  return a === undefined ? 1 : -1;
}
