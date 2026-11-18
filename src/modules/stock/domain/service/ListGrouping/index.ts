export interface GroupableRow {
  categoryId?: string;
  description: string;
  estimateCents?: number;
}
export interface RowGroup<T extends GroupableRow> {
  categoryId?: string;
  rows: T[];
  subtotalCents: number;
  unpricedCount: number;
}

// Spec 118 FR 19: groups by category name, rows by description; rows without category go last ("Outros").
export function groupRows<T extends GroupableRow>(
  rows: T[],
  categoryName: (categoryId: string) => string | undefined,
): RowGroup<T>[] {
  const buckets = new Map<string | undefined, T[]>();

  for (const row of rows) {
    const key = row.categoryId && categoryName(row.categoryId) ? row.categoryId : undefined;

    buckets.set(key, [...(buckets.get(key) ?? []), row]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => {
      if (a === undefined) {
        return b === undefined ? 0 : 1;
      }

      if (b === undefined) {
        return -1;
      }

      return (categoryName(a) ?? '').localeCompare(categoryName(b) ?? '') || a.localeCompare(b);
    })
    .map(([categoryId, group]) => {
      const sorted = [...group].sort((a, b) => a.description.localeCompare(b.description));

      return {
        categoryId,
        rows: sorted,
        subtotalCents: sorted.reduce((sum, row) => sum + (row.estimateCents ?? 0), 0),
        unpricedCount: sorted.filter((row) => row.estimateCents === undefined).length,
      };
    });
}
