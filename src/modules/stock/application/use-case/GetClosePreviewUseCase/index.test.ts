import { day, item, lot, mocks, purchaseRow, setup } from './index.mocks';

const base = { accessibleOwners: mocks.accessibleOwners, id: 'p' };

it('SHOULD list the missing prices, the missing weights AND the new items with a suggestion', async () => {
  mocks.purchases.findRows.mockResolvedValue([
    purchaseRow('a', {
      item: { categoryId: 'c1', description: 'Rice', id: 'i', unit: 'unit' as never },
      itemId: 'i',
      lineTotalCents: 600,
    }),
    purchaseRow('b', { description: 'Candle', unit: 'unit' as never }),
    purchaseRow('c', {
      item: { description: 'Beans', id: 'i3', unit: 'kilogram' as never },
      itemId: 'i3',
    }),
    purchaseRow('gone', { state: 'NOT_FOUND' }),
  ]);
  mocks.suggest.execute.mockResolvedValue([{ description: 'Vela', id: 'vela' }]);

  const preview = await setup.execute(base);

  expect(preview.missingPrices).toEqual(['b', 'c']);
  expect(preview.unknownWeight).toEqual(['c']);
  expect(preview.newItems).toEqual([
    {
      description: 'Candle',
      rowId: 'b',
      suggestion: { description: 'Vela', itemId: 'vela' },
      unit: 'unit',
    },
  ]);
  expect(preview.financeParts).toBeNull();
});

it('SHOULD suggest an expiration from the dated lots of the last 12 months', async () => {
  mocks.purchases.findRows.mockResolvedValue([
    purchaseRow('a', {
      item: { description: 'Milk', id: 'i', unit: 'unit' as never },
      itemId: 'i',
      lineTotalCents: 100,
    }),
  ]);
  mocks.stock.findById.mockResolvedValue(
    item([lot('l1', 1, { expirationDate: day('2026-07-11'), purchaseDate: day('2026-07-01') })]),
  );

  const preview = await setup.execute(base);

  expect(preview.expirations).toEqual([{ rowId: 'a', suggestedDate: day('2026-11-20') }]);
});

it('SHOULD build the finance parts WHEN the receipt total is sent AND report the rule that fails', async () => {
  mocks.purchases.findRows.mockResolvedValue([
    purchaseRow('a', {
      item: { categoryId: 'c1', description: 'Rice', id: 'i', unit: 'unit' as never },
      itemId: 'i',
      lineTotalCents: 600,
    }),
  ]);

  expect((await setup.execute({ ...base, receiptTotalCents: 600 })).financeParts).toEqual([
    { categoryId: 'fin-food', kind: 'CATEGORY', valueCents: 600 },
  ]);

  mocks.purchases.findRows.mockResolvedValue([purchaseRow('a'), purchaseRow('b')]);
  const failed = await setup.execute({ ...base, receiptTotalCents: 600 });

  expect(failed.financeParts).toBeNull();
  expect(failed.financeError).toBe('PURCHASE_PRICE_REQUIRED');
});

it('SHOULD ask for the default finance category WHEN the list has none and a row has no mapping', async () => {
  mocks.lists.findById.mockResolvedValue(undefined);
  mocks.purchases.findRows.mockResolvedValue([purchaseRow('a', { lineTotalCents: 100 })]);

  expect((await setup.execute(base)).needsDefaultFinanceCategory).toBe(true);
});
