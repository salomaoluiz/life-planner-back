// The last row dated on or before `date`; `sorted` is ascending by `date` (`YYYY-MM-DD`).
export function latestOnOrBefore<T extends { date: string }>(
  sorted: T[],
  date: string,
): T | undefined {
  let low = 0;
  let high = sorted.length - 1;
  let found: T | undefined;

  while (low <= high) {
    const middle = (low + high) >> 1;
    const row = sorted[middle] as T;

    if (row.date <= date) {
      found = row;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return found;
}
