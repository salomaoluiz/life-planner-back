import { buildWasteReport, WasteGroupRow, WasteItemRow } from '@stock/domain/service/WasteReport';

const roots: Record<string, { id: string; name: string }> = {
  leaf: { id: 'veg', name: 'Hortifrúti' },
  veg: { id: 'veg', name: 'Hortifrúti' },
};

function group(extra: Partial<WasteGroupRow>): WasteGroupRow {
  return {
    count: 1,
    currency: 'BRL',
    items: 1,
    period: 'CURRENT',
    scope: 'TOTAL',
    unpriced: 0,
    valueCents: 0,
    ...extra,
  };
}
function itemRow(extra: Partial<WasteItemRow>): WasteItemRow {
  return {
    count: 1,
    currency: 'BRL',
    description: 'Iogurte',
    itemId: 'i1',
    quantity: 1,
    reason: 'EXPIRED',
    unit: 'unit',
    valueCents: 100,
    ...extra,
  };
}
function report(
  groups: WasteGroupRow[],
  itemRows: WasteItemRow[] = [],
  topLimit: 'all' | number = 5,
) {
  return buildWasteReport({
    firstDiscard: new Date('2026-03-10T00:00:00.000Z'),
    groups,
    itemRows,
    month: '2026-11',
    rootOf: (id) => roots[id],
    topLimit,
  });
}

it('SHOULD give totals per currency, never summed, with the previous month and the first month', () => {
  const result = report([
    group({ count: 7, currency: 'BRL', items: 5, valueCents: 6340 }),
    group({ count: 1, currency: 'EUR', items: 1, valueCents: 250 }),
    group({ count: 1, currency: null, items: 1, unpriced: 1, valueCents: 0 }),
    group({ count: 8, period: 'PREVIOUS', valueCents: 5130 }),
  ]);

  expect(result.totals).toEqual([
    { currency: 'BRL', discardCount: 7, itemCount: 5, unpricedCount: 1, valueCents: 6340 },
    { currency: 'EUR', discardCount: 1, itemCount: 1, unpricedCount: 1, valueCents: 250 },
  ]);
  expect(result.previousMonth).toEqual([{ currency: 'BRL', discardCount: 8, valueCents: 5130 }]);
  expect(result.summary).toMatchObject({ discardCount: 9, unpricedCount: 1 });
  expect(result.firstMonth).toBe('2026-03');
});

it('SHOULD group by reason, ordered by value', () => {
  const result = report([
    group({ count: 7, reason: 'EXPIRED', scope: 'REASON', valueCents: 4110 }),
    group({ count: 3, reason: 'SPOILED', scope: 'REASON', valueCents: 2230 }),
  ]);

  expect(result.byReason.map((row) => row.reason)).toEqual(['EXPIRED', 'SPOILED']);
  expect(result.byReason[0].totals).toEqual([{ currency: 'BRL', valueCents: 4110 }]);
});

it('SHOULD fold categories into their top-level category AND keep "Sem categoria" as null', () => {
  const result = report([
    group({ categoryId: 'leaf', count: 2, scope: 'CATEGORY', valueCents: 1000 }),
    group({ categoryId: 'veg', count: 1, scope: 'CATEGORY', valueCents: 500 }),
    group({ categoryId: null, count: 1, scope: 'CATEGORY', valueCents: 100 }),
  ]);

  expect(result.byCategory).toEqual([
    {
      category: { id: 'veg', name: 'Hortifrúti' },
      count: 3,
      totals: [{ currency: 'BRL', valueCents: 1500 }],
    },
    { category: null, count: 1, totals: [{ currency: 'BRL', valueCents: 100 }] },
  ]);
});

it('SHOULD rank the items by value then count, cap at 5 and count the rest', () => {
  const rows = Array.from({ length: 7 }, (_, index) =>
    itemRow({ description: `Item ${index}`, itemId: `i${index}`, valueCents: 100 * (index + 1) }),
  );
  const result = report([], rows);

  expect(result.topItems).toHaveLength(5);
  expect(result.topItems[0].itemId).toBe('i6');
  expect(result.moreItemsCount).toBe(2);
  expect(report([], rows, 'all').topItems).toHaveLength(7);
  expect(report([], rows, 'all').moreItemsCount).toBe(0);
});

it('SHOULD merge the rows of one item AND pick its main reason', () => {
  const result = report(
    [],
    [
      itemRow({ count: 1, reason: 'EXPIRED', valueCents: 100 }),
      itemRow({ count: 2, quantity: 2, reason: 'SPOILED', valueCents: 200 }),
    ],
  );

  expect(result.topItems).toEqual([
    {
      count: 3,
      description: 'Iogurte',
      itemId: 'i1',
      mainReason: 'SPOILED',
      quantity: 3,
      totals: [{ currency: 'BRL', valueCents: 300 }],
      unit: 'unit',
    },
  ]);
});

it('SHOULD be empty for a month without discards', () => {
  const result = buildWasteReport({
    firstDiscard: null,
    groups: [],
    itemRows: [],
    month: '2026-11',
    rootOf: () => undefined,
    topLimit: 5,
  });

  expect(result).toMatchObject({
    byCategory: [],
    byReason: [],
    firstMonth: null,
    topItems: [],
    totals: [],
  });
  expect(result.summary).toEqual({ discardCount: 0, itemCount: 0, unpricedCount: 0 });
});
