import { Prisma } from '@db/client';

import { recomputeForecasts } from './index';

const today = new Date('2026-11-25T00:00:00.000Z');

function asTx(value: unknown) {
  return value as Prisma.TransactionClient;
}
function tx(movements: unknown[] = []) {
  return {
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockResolvedValue(movements),
    stockItem: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'a', min_quantity: 2, opened_shelf_life_days: null, stock_only: false, unit: 'unit' },
        {
          id: 's',
          min_quantity: null,
          opened_shelf_life_days: null,
          stock_only: true,
          unit: 'unit',
        },
      ]),
    },
    stockLot: {
      findMany: jest.fn().mockResolvedValue([
        {
          expiration_date: null,
          id: 'l1',
          item_id: 'a',
          leftover_dismissed_at: null,
          leftover_dismissed_quantity: null,
          opened_at: null,
          quantity: 10,
        },
      ]),
    },
  };
}
// An entry of 40 thirty-one days ago, then one consume of 1 a day (10 left).
function steady() {
  return [
    ...Array.from({ length: 30 }, (_, index) => ({
      age_days: index + 1,
      count: 1,
      item_id: 'a',
      quantity: -1,
      type: 'CONSUME',
    })),
    { age_days: 31, count: 1, item_id: 'a', quantity: 40, type: 'ENTRY' },
  ];
}

it('SHOULD read and write once for any number of items', async () => {
  const client = tx(steady());

  await recomputeForecasts(asTx(client), ['a', 's'], today);

  expect(client.stockItem.findMany).toHaveBeenCalledTimes(1);
  expect(client.stockLot.findMany).toHaveBeenCalledTimes(1);
  expect(client.$queryRaw).toHaveBeenCalledTimes(1);
  expect(client.$executeRaw).toHaveBeenCalledTimes(1);
  expect((client.$executeRaw.mock.calls[0][0] as Prisma.Sql).sql).toContain('UPDATE "stock_items"');
});

it('SHOULD write the OK forecast of a steady consumer AND null for a stock-only item', async () => {
  const client = tx(steady());

  await recomputeForecasts(asTx(client), ['a', 's'], today);

  const values = (client.$executeRaw.mock.calls[0][0] as Prisma.Sql).values;

  // item a: id, status, rate 1, min date today + 8 days
  expect(values.slice(0, 3)).toEqual(['a', 'OK', 1]);
  expect(values[3]).toEqual(new Date('2026-12-03T00:00:00.000Z'));
  // item s: status null
  expect(values[10]).toBe('s');
  expect(values[11]).toBeNull();
});

it('SHOULD write INSUFFICIENT_DATA WHEN there is no consumption', async () => {
  const client = tx([]);

  await recomputeForecasts(asTx(client), ['a'], today);

  expect((client.$executeRaw.mock.calls[0][0] as Prisma.Sql).values.slice(0, 3)).toEqual([
    'a',
    'INSUFFICIENT_DATA',
    null,
  ]);
});

it('SHOULD do nothing for no items', async () => {
  const client = tx();

  await recomputeForecasts(asTx(client), [], today);

  expect(client.$queryRaw).not.toHaveBeenCalled();
});
