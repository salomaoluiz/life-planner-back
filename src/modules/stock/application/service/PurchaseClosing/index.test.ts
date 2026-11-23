import { UnprocessableEntityException } from '@nestjs/common';

import { purchaseRow } from '@stock/application/mocks/stock.mocks';

import {
  missingWeightRows,
  noPriceLabel,
  purchaseDescription,
  runClosingPlan,
  toClosingRows,
} from './index';

describe('missingWeightRows', () => {
  it('SHOULD list the kg and liter rows without quantity unless the closing typed it', () => {
    const rows = [
      purchaseRow('a', { unit: 'kilogram' as never }),
      purchaseRow('b', { quantity: 2, unit: 'liter' as never }),
      purchaseRow('c', { unit: 'unit' as never }),
    ];

    expect(missingWeightRows(rows, new Map())).toEqual(['a']);
    expect(missingWeightRows(rows, new Map([['a', { quantity: 1.2, rowId: 'a' }]]))).toEqual([]);
  });
});

describe('toClosingRows', () => {
  it('SHOULD resolve typed prices AND map the item category to its finance category', () => {
    const { resolved, rows } = toClosingRows(
      [
        purchaseRow('a', {
          item: { categoryId: 'c1', description: 'x', id: 'i', unit: 'unit' as never },
          quantity: 2,
        }),
        purchaseRow('b', { lineTotalCents: 500, quantity: 1 }),
      ],
      new Map([['a', { rowId: 'a', unitPriceCents: 250 }]]),
      [{ financeCategoryId: 'fin', id: 'c1', name: 'Food' }],
    );

    expect(rows[0]).toMatchObject({ financeCategoryId: 'fin', id: 'a', lineTotalCents: 500 });
    expect(rows[1]).toMatchObject({ id: 'b', lineTotalCents: 500 });
    expect(resolved.get('a')).toMatchObject({ quantity: 2, unitPriceCents: 250 });
  });

  it('SHOULD drop the price of a row marked "Não sei" AND accept a typed line total', () => {
    const { rows } = toClosingRows(
      [purchaseRow('a', { quantity: 2 }), purchaseRow('b', { quantity: 2 })],
      new Map([
        ['a', { lineTotalCents: 400, rowId: 'a', unknownPrice: true }],
        ['b', { lineTotalCents: 400, rowId: 'b' }],
      ]),
      [],
    );

    expect(rows[0].lineTotalCents).toBeUndefined();
    expect(rows[1].lineTotalCents).toBe(400);
  });
});

describe('runClosingPlan / labels', () => {
  it('SHOULD turn a closing rule into a 422 carrying its code', () => {
    expect(() => runClosingPlan({ rows: [] })).toThrow(UnprocessableEntityException);
    expect(() => runClosingPlan({ rows: [] })).toThrow('receipt total');
  });

  it('SHOULD localize the description AND the no-price label', () => {
    expect(purchaseDescription('Bom Preço')).toBe('Compra no Bom Preço');
    expect(purchaseDescription('Bom Preço', 'en-US')).toBe('Purchase at Bom Preço');
    expect(noPriceLabel()).toBe('Sem preço');
    expect(noPriceLabel('en-US')).toBe('No price');
  });

  it('SHOULD rethrow what is not a closing rule', () => {
    expect(() => runClosingPlan(null as never)).toThrow(TypeError);
  });
});
