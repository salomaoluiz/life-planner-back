// Spec 123 FR 30-31: the Waste screen numbers, built from two grouped reads. Values are per currency and never summed
// across currencies; discards without a price (currency null) count in quantity and `unpricedCount` only.
export interface CurrencyTotal {
  currency: string;
  valueCents: number;
}
export interface WasteGroupRow {
  count: number;
  currency: null | string;
  // Distinct items (only meaningful for the TOTAL scope).
  categoryId?: null | string;
  items: number;
  period: 'CURRENT' | 'PREVIOUS';
  reason?: string;
  scope: 'CATEGORY' | 'REASON' | 'TOTAL';
  unpriced: number;
  valueCents: number;
}
export interface WasteItemRow {
  count: number;
  currency: null | string;
  description: string;
  itemId: string;
  quantity: number;
  reason: string;
  unit: string;
  valueCents: number;
}
export interface WasteReport {
  byCategory: {
    category: { id: string; name: string } | null;
    count: number;
    totals: CurrencyTotal[];
  }[];
  byReason: { count: number; reason: string; totals: CurrencyTotal[] }[];
  firstMonth: null | string;
  month: string;
  moreItemsCount: number;
  previousMonth: { currency: string; discardCount: number; valueCents: number }[];
  summary: { discardCount: number; itemCount: number; unpricedCount: number };
  topItems: {
    count: number;
    description: string;
    itemId: string;
    mainReason: string;
    quantity: number;
    totals: CurrencyTotal[];
    unit: string;
  }[];
  totals: {
    currency: string;
    discardCount: number;
    itemCount: number;
    unpricedCount: number;
    valueCents: number;
  }[];
}

export const TOP_ITEMS_LIMIT = 5;

export function buildWasteReport(input: {
  firstDiscard: Date | null;
  groups: WasteGroupRow[];
  itemRows: WasteItemRow[];
  month: string;
  rootOf: (categoryId: string) => { id: string; name: string } | undefined;
  topLimit: 'all' | number;
}): WasteReport {
  const current = input.groups.filter((row) => row.period === 'CURRENT');
  const totalRows = current.filter((row) => row.scope === 'TOTAL');
  const unpricedCount = totalRows.reduce((sum, row) => sum + row.unpriced, 0);
  const priced = totalRows.filter((row) => row.currency !== null);
  const items = rankItems(input.itemRows);
  const limit = input.topLimit === 'all' ? items.length : input.topLimit;

  return {
    byCategory: byCategory(
      current.filter((row) => row.scope === 'CATEGORY'),
      input.rootOf,
    ),
    byReason: byReason(current.filter((row) => row.scope === 'REASON')),
    firstMonth: input.firstDiscard ? input.firstDiscard.toISOString().slice(0, 7) : null,
    month: input.month,
    moreItemsCount: Math.max(0, items.length - limit),
    previousMonth: input.groups
      .filter((row) => row.period === 'PREVIOUS' && row.scope === 'TOTAL' && row.currency !== null)
      .map((row) => ({
        currency: row.currency as string,
        discardCount: row.count,
        valueCents: row.valueCents,
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
    summary: {
      discardCount: totalRows.reduce((sum, row) => sum + row.count, 0),
      // Distinct items across currencies cannot be derived from per-currency rows: the largest bucket is a floor, the
      // item rows give the exact count.
      itemCount: new Set(input.itemRows.map((row) => row.itemId)).size,
      unpricedCount,
    },
    topItems: items.slice(0, limit),
    totals: priced
      .map((row) => ({
        currency: row.currency as string,
        discardCount: row.count,
        itemCount: row.items,
        unpricedCount,
        valueCents: row.valueCents,
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}

function addTotal(
  totals: Map<string, number>,
  row: { currency: null | string; valueCents: number },
) {
  if (row.currency !== null) {
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.valueCents);
  }
}
function byCategory(
  rows: WasteGroupRow[],
  rootOf: (categoryId: string) => { id: string; name: string } | undefined,
): WasteReport['byCategory'] {
  const groups = new Map<
    string,
    { category: { id: string; name: string } | null; count: number; totals: Map<string, number> }
  >();

  for (const row of rows) {
    const root = row.categoryId ? rootOf(row.categoryId) : undefined;
    const key = root?.id ?? '';
    const group = groups.get(key) ?? { category: root ?? null, count: 0, totals: new Map() };

    group.count += row.count;
    addTotal(group.totals, row);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      category: group.category,
      count: group.count,
      totals: toTotals(group.totals),
    }))
    .sort(
      (a, b) =>
        sumValue(b.totals) - sumValue(a.totals) ||
        b.count - a.count ||
        (a.category?.name ?? '').localeCompare(b.category?.name ?? ''),
    );
}
function byReason(rows: WasteGroupRow[]): WasteReport['byReason'] {
  const groups = new Map<string, { count: number; totals: Map<string, number> }>();

  for (const row of rows) {
    const group = groups.get(row.reason as string) ?? { count: 0, totals: new Map() };

    group.count += row.count;
    addTotal(group.totals, row);
    groups.set(row.reason as string, group);
  }

  return [...groups.entries()]
    .map(([reason, group]) => ({ count: group.count, reason, totals: toTotals(group.totals) }))
    .sort(
      (a, b) =>
        sumValue(b.totals) - sumValue(a.totals) ||
        b.count - a.count ||
        a.reason.localeCompare(b.reason),
    );
}
function sumValue(totals: CurrencyTotal[]): number {
  return totals.reduce((sum, total) => sum + total.valueCents, 0);
}
function toTotals(totals: Map<string, number>): CurrencyTotal[] {
  return [...totals.entries()]
    .map(([currency, valueCents]) => ({ currency, valueCents }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
// Top items by value, then by count, then by name; the main reason is the one with most discards.
function rankItems(rows: WasteItemRow[]): WasteReport['topItems'] {
  const items = new Map<
    string,
    {
      count: number;
      description: string;
      quantity: number;
      reasons: Map<string, number>;
      totals: Map<string, number>;
      unit: string;
    }
  >();

  for (const row of rows) {
    const item = items.get(row.itemId) ?? {
      count: 0,
      description: row.description,
      quantity: 0,
      reasons: new Map(),
      totals: new Map(),
      unit: row.unit,
    };

    item.count += row.count;
    item.quantity += row.quantity;
    item.reasons.set(row.reason, (item.reasons.get(row.reason) ?? 0) + row.count);
    addTotal(item.totals, row);
    items.set(row.itemId, item);
  }

  return [...items.entries()]
    .map(([itemId, item]) => ({
      count: item.count,
      description: item.description,
      itemId,
      mainReason: [...item.reasons.entries()].sort(
        ([a, x], [b, y]) => y - x || a.localeCompare(b),
      )[0][0],
      quantity: Math.round(item.quantity * 1000) / 1000,
      totals: toTotals(item.totals),
      unit: item.unit,
    }))
    .sort(
      (a, b) =>
        sumValue(b.totals) - sumValue(a.totals) ||
        b.count - a.count ||
        a.description.localeCompare(b.description),
    );
}
