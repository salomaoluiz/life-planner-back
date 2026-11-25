import { Prisma } from '@db/client';

import { dismissIfNeeded, syncOwnerRows, syncRestockRows } from './index';

jest.mock('@stock/data/datasource/ForecastSync', () => ({ recomputeForecasts: jest.fn() }));

function asTx(value: unknown) {
  return value as Prisma.TransactionClient;
}
function sqlOf(call: unknown[]) {
  return (call[0] as Prisma.Sql).sql;
}
function tx(created = 0) {
  return {
    $executeRaw: jest
      .fn()
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(created)
      .mockResolvedValue(0),
    stockItem: {
      findMany: jest.fn().mockResolvedValue([{ id: 'a', owner: 'USER', owner_id: 'u' }]),
    },
  };
}

it('SHOULD run three statements (cleanup, default list, upsert) for any number of items', async () => {
  const client = tx();

  await syncRestockRows(asTx(client), ['a', 'b']);

  expect(client.$executeRaw).toHaveBeenCalledTimes(3);
  expect(sqlOf(client.$executeRaw.mock.calls[0])).toContain(
    'DELETE FROM "stock_restock_dismissals"',
  );
  expect(sqlOf(client.$executeRaw.mock.calls[0])).toContain('r."origin" = \'AUTO\'');
  expect(sqlOf(client.$executeRaw.mock.calls[1])).toContain('INSERT INTO "stock_shopping_lists"');
  expect(sqlOf(client.$executeRaw.mock.calls[2])).toContain('ON CONFLICT ("list_id", "item_id")');
});

it('SHOULD pass the clearDismissal flag to the cleanup statement', async () => {
  const client = tx();

  await syncRestockRows(asTx(client), ['a'], { clearDismissal: true });

  expect((client.$executeRaw.mock.calls[0][0] as Prisma.Sql).values).toContain(true);
});

it('SHOULD do nothing for no items', async () => {
  const client = tx();

  await syncRestockRows(asTx(client), []);

  expect(client.$executeRaw).not.toHaveBeenCalled();
});

it('SHOULD sync every item of the owners WHEN a default list was just created (once)', async () => {
  const client = tx(1);

  await syncRestockRows(asTx(client), ['a']);

  expect(client.stockItem.findMany).toHaveBeenCalledTimes(2);
  // 3 statements + 3 of the expanded run (the second one finds the default list already there).
  expect(client.$executeRaw).toHaveBeenCalledTimes(6);
});

it('SHOULD skip an empty owner list AND sync the items of the owners', async () => {
  const client = tx();

  await syncOwnerRows(asTx(client), []);
  expect(client.stockItem.findMany).not.toHaveBeenCalled();

  await syncOwnerRows(asTx(client), [{ owner: 'USER', owner_id: 'u' }]);
  expect(client.$executeRaw).toHaveBeenCalledTimes(3);
});

it('SHOULD record the dismissal only for an item that still needs restocking', async () => {
  const client = tx();

  await dismissIfNeeded(asTx(client), 'a', 'user');

  expect(sqlOf(client.$executeRaw.mock.calls[0])).toContain('f."needs"');
  expect(sqlOf(client.$executeRaw.mock.calls[0])).toContain('ON CONFLICT DO NOTHING');
});

describe('forecast refresh (spec 123 FR 13)', () => {
  it('SHOULD recompute the forecast of the items first, unless told to reuse it', async () => {
    const { recomputeForecasts } = jest.requireMock('@stock/data/datasource/ForecastSync');

    recomputeForecasts.mockClear();
    await syncRestockRows(asTx(tx()), ['a', 'b']);
    await syncRestockRows(asTx(tx()), ['a'], { forecast: 'reuse' });

    expect(recomputeForecasts).toHaveBeenCalledTimes(1);
    expect(recomputeForecasts.mock.calls[0][1]).toEqual(['a', 'b']);
  });
});

describe('FORECAST rows (spec 123 FR 15)', () => {
  it('SHOULD delete a FORECAST row that no longer applies AND keep the dismissal while the forecast wants a row', async () => {
    const client = tx();

    await syncRestockRows(asTx(client), ['a'], { forecast: 'reuse' });

    const cleanup = sqlOf(client.$executeRaw.mock.calls[0]);

    expect(cleanup).toContain('r."origin" = \'FORECAST\'');
    expect(cleanup).toContain('NOT f."needs" AND NOT f."wants_forecast"');
  });

  it('SHOULD upsert AUTO at the minimum and FORECAST before the next trip, turning FORECAST into AUTO', async () => {
    const client = tx();

    await syncRestockRows(asTx(client), ['a'], { forecast: 'reuse' });

    const upsert = sqlOf(client.$executeRaw.mock.calls[2]);

    expect(upsert).toContain('f."needs" OR f."wants_forecast"');
    expect(upsert).toContain('"origin" = EXCLUDED."origin"');
    expect(upsert).toContain("\"origin\" IN ('AUTO', 'FORECAST')");
  });

  it('SHOULD derive the next trip from the last CLOSED purchase and the list interval', async () => {
    const client = tx();

    await syncRestockRows(asTx(client), ['a'], { forecast: 'reuse' });

    const cleanup = sqlOf(client.$executeRaw.mock.calls[0]);

    expect(cleanup).toContain('p."status" = \'CLOSED\'');
    expect(cleanup).toContain('"purchase_interval_days"');
    expect(cleanup).toContain('f."forecast_min_date"'.replace('f.', 'b.'));
  });

  it('SHOULD dismiss a removed row WHEN the item still has a forecast row', async () => {
    const client = tx();

    await dismissIfNeeded(asTx(client), 'a', 'user');

    expect(sqlOf(client.$executeRaw.mock.calls[0])).toContain('f."needs" OR f."wants_forecast"');
  });
});
