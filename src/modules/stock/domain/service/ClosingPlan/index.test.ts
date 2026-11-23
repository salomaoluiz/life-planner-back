import { ClosingError, planClosing } from './index';

function row(id: string, lineTotalCents?: number, extra: object = {}) {
  return { id, lineTotalCents, ...extra };
}

describe('planClosing', () => {
  it('SHOULD require the receipt total', () => {
    expect(() => planClosing({ rows: [] })).toThrow(ClosingError);
  });

  it('SHOULD group by category AND post a negative adjustment when all rows are priced', () => {
    const plan = planClosing({
      defaultFinanceCategoryId: 'cat-default',
      receiptTotalCents: 900,
      rows: [
        row('a', 400, { financeCategoryId: 'cat-food' }),
        row('b', 300, { financeCategoryId: 'cat-food' }),
        row('c', 300),
      ],
    });

    expect(plan.parts).toEqual([
      { categoryId: 'cat-default', kind: 'CATEGORY', valueCents: 300 },
      { categoryId: 'cat-food', kind: 'CATEGORY', valueCents: 700 },
      { kind: 'ADJUSTMENT', valueCents: -100 },
    ]);
  });

  it('SHOULD drop a zero adjustment', () => {
    const plan = planClosing({
      defaultFinanceCategoryId: 'cat',
      receiptTotalCents: 500,
      rows: [row('a', 500)],
    });

    expect(plan.parts).toEqual([{ categoryId: 'cat', kind: 'CATEGORY', valueCents: 500 }]);
  });

  it('SHOULD give the difference to the single row without price', () => {
    const plan = planClosing({
      defaultFinanceCategoryId: 'cat',
      receiptTotalCents: 1000,
      rows: [row('a', 400), row('b')],
    });

    expect(plan.rows).toEqual([
      { filledByDifference: false, id: 'a', lineTotalCents: 400 },
      { filledByDifference: true, id: 'b', lineTotalCents: 600 },
    ]);
  });

  it('SHOULD refuse the single row WHEN nothing is left for it', () => {
    expect(() =>
      planClosing({
        defaultFinanceCategoryId: 'cat',
        receiptTotalCents: 400,
        rows: [row('a', 400), row('b')],
      }),
    ).toThrow(/nothing/);
  });

  it('SHOULD form "Sem preço" from the unknown rows', () => {
    const plan = planClosing({
      defaultFinanceCategoryId: 'cat',
      receiptTotalCents: 1000,
      rows: [
        row('a', 400),
        row('b', undefined, { unknownPrice: true }),
        row('c', undefined, { unknownPrice: true }),
      ],
    });

    expect(plan.parts).toEqual([
      { categoryId: 'cat', kind: 'CATEGORY', valueCents: 400 },
      { categoryId: 'cat', kind: 'NO_PRICE', valueCents: 600 },
    ]);
  });

  it('SHOULD refuse two unpriced rows without "unknown" AND a total below the items', () => {
    expect(() =>
      planClosing({
        defaultFinanceCategoryId: 'cat',
        receiptTotalCents: 1000,
        rows: [row('a', 400), row('b'), row('c')],
      }),
    ).toThrow(/price or/);
    expect(() =>
      planClosing({
        defaultFinanceCategoryId: 'cat',
        receiptTotalCents: 300,
        rows: [row('a', 400), row('b', undefined, { unknownPrice: true })],
      }),
    ).toThrow(/below/);
  });

  it('SHOULD ask the default finance category WHEN a row has none', () => {
    expect(() => planClosing({ receiptTotalCents: 100, rows: [row('a', 100)] })).toThrow(
      /finance category/,
    );
  });
});
