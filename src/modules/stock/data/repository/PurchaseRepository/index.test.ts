import { ConflictException } from '@nestjs/common';

import { toPurchase, toRow } from './index';
import {
  at,
  client,
  databaseMock,
  day,
  models,
  rawPurchase,
  rawRow,
  raws,
  setup,
} from './index.mocks';

jest.mock('@stock/data/datasource/RestockSync', () => ({ syncRestockRows: jest.fn() }));

const user = 'user-id';
const owners = [{ owner: 'USER' as never, ownerId: user }];

describe('mappers', () => {
  it('SHOULD map the purchase AND the row with its item and checker', () => {
    expect(toPurchase(rawPurchase({ split_id: 's1' }) as never)).toMatchObject({
      id: 'p1',
      owner: 'USER',
      splitId: 's1',
      status: 'OPEN',
    });
    expect(
      toRow({
        ...rawRow({ item_id: 'i1' }),
        item: { category_id: 'c1', description: 'Rice', id: 'i1', unit: 'unit' },
      } as never),
    ).toMatchObject({
      checkedBy: { id: user, name: 'Ana' },
      item: { categoryId: 'c1', id: 'i1' },
      quantity: 2,
    });
  });
});

describe('create', () => {
  it('SHOULD create the purchase AND an event; a repeat by the same user is idempotent', async () => {
    models.stockPurchase.findUnique.mockResolvedValueOnce(null);
    models.stockPurchase.create.mockResolvedValue(rawPurchase());

    const first = await setup.create({
      currency: 'BRL',
      id: 'p1',
      listId: 'list-id',
      marketId: 'market-id',
      owner: 'USER' as never,
      ownerId: user,
      purchaseDate: day('2026-11-18'),
      userId: user,
    });

    expect(first.created).toBe(true);
    expect(raws.$executeRaw).toHaveBeenCalledTimes(1);

    const again = await setup.create({
      ...{
        currency: 'BRL',
        id: 'p1',
        listId: 'l',
        marketId: 'm',
        owner: 'USER' as never,
        ownerId: user,
        purchaseDate: day('2026-11-18'),
      },
      userId: user,
    });

    expect(again.created).toBe(false);
  });

  it('SHOULD answer 409 WHEN the id belongs to a purchase of someone else', async () => {
    await expect(
      setup.create({
        currency: 'BRL',
        id: 'p1',
        listId: 'l',
        marketId: 'm',
        owner: 'USER' as never,
        ownerId: user,
        purchaseDate: day('2026-11-18'),
        userId: 'other',
      }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('reads', () => {
  it('SHOULD find a purchase by id AND by list statuses AND a closed page with keyset', async () => {
    models.stockPurchase.findMany.mockResolvedValue([rawPurchase()]);

    expect((await setup.findById('p1'))?.id).toBe('p1');
    models.stockPurchase.findUnique.mockResolvedValueOnce(null);
    expect(await setup.findById('x')).toBeUndefined();
    expect(await setup.findByList('list-id', ['OPEN' as never])).toHaveLength(1);
    await setup.findClosedByList('list-id', 3, { closedAt: at, id: 'p0' });
    expect(models.stockPurchase.findMany.mock.calls[1][0].where.OR).toHaveLength(2);
    await setup.findClosedByList('list-id', 3);
    expect(models.stockPurchase.findMany.mock.calls[2][0].where.OR).toBeUndefined();
  });

  it('SHOULD read rows AND events AND the last prices (one grouped read per call)', async () => {
    models.stockPurchaseRow.findMany.mockResolvedValue([rawRow()]);
    models.stockPurchaseEvent.findMany.mockResolvedValue([
      { id: 7n, payload: { a: 1 }, purchase_id: 'p1', type: 'row.upserted' },
    ]);
    models.stockPriceHistory.findMany.mockResolvedValue([
      { date: at, item_id: 'i1', unit_price_cents: 100 },
    ]);

    expect(await setup.findRows([])).toEqual([]);
    expect(await setup.findRows(['p1'])).toHaveLength(1);
    expect(await setup.findEventsAfter('list-id', 3n, 10)).toEqual([
      { id: 7n, payload: { a: 1 }, purchaseId: 'p1', type: 'row.upserted' },
    ]);
    expect(await setup.findLastPrices([], 'm')).toEqual(new Map());
    expect((await setup.findLastPrices(['i1'], 'm')).get('i1')).toEqual({
      date: at,
      unitPriceCents: 100,
    });
  });

  it('SHOULD read the other carts AND the pending purchases with the cart totals', async () => {
    models.stockPurchaseRow.findMany.mockResolvedValue([
      {
        checker: { name: 'Ana' },
        list_row_id: 'l1',
        purchase: { market: { name: 'Atacadão' } },
        purchase_id: 'p2',
      },
    ]);
    models.stockPurchase.findMany.mockResolvedValue([
      {
        ...rawPurchase({ status: 'ENDED' }),
        list: { name: 'Mercado' },
        market: { name: 'Atacadão' },
        rows: [
          { line_total_cents: 500, state: 'IN_CART' },
          { line_total_cents: 999, state: 'NOT_FOUND' },
        ],
      },
    ]);

    expect(await setup.findOtherCarts('list-id', 'p1')).toEqual([
      { listRowId: 'l1', marketName: 'Atacadão', purchaseId: 'p2', userName: 'Ana' },
    ]);
    expect(await setup.findPending([], at)).toEqual([]);
    expect(await setup.findPending(owners, at)).toEqual([
      expect.objectContaining({
        cartTotalCents: 500,
        checkedCount: 1,
        listName: 'Mercado',
        status: 'ENDED',
      }),
    ]);
  });

  it('SHOULD page the price history with a keyset AND a market filter', async () => {
    models.stockPriceHistory.findMany.mockResolvedValue([
      { date: at, id: 'h1', market_id: 'm', unit_price_cents: 100 },
    ]);

    expect(await setup.findPriceHistory('i1', 10, 'm', { date: at, id: 'h0' })).toEqual([
      { date: at, id: 'h1', marketId: 'm', unitPriceCents: 100 },
    ]);
    const where = models.stockPriceHistory.findMany.mock.calls[0][0].where;

    expect(where.market_id).toBe('m');
    expect(where.OR).toHaveLength(2);
  });

  it('SHOULD flag the rows whose lot got a later movement', async () => {
    models.stockPurchaseRow.findMany.mockResolvedValue([
      { entry_movement: { created_at: at, id: 'mv1', lot_id: 'lot1' }, id: 'r1' },
      { entry_movement: { created_at: at, id: 'mv2', lot_id: 'lot2' }, id: 'r2' },
    ]);
    models.stockMovement.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    expect(await setup.findUsedRowIds('p1')).toEqual(['r1']);
  });
});

describe('discardIdle / deleteByOwner', () => {
  it('SHOULD discard only open purchases without checked rows AND skip without owners', async () => {
    models.stockPurchase.updateMany.mockResolvedValue({ count: 2 });

    expect(await setup.discardIdle([], at)).toBe(0);
    expect(await setup.discardIdle(owners, at)).toBe(2);
    expect(models.stockPurchase.updateMany.mock.calls[0][0].where.rows).toEqual({
      none: { state: 'IN_CART' },
    });
  });

  it('SHOULD delete events AND purchases of the owner', async () => {
    models.stockPurchase.findMany.mockResolvedValue([{ id: 'p1' }]);

    await setup.deleteByOwner({ owner: 'USER' as never, ownerId: user });

    expect(models.stockPurchaseEvent.deleteMany).toHaveBeenCalledWith({
      where: { purchase_id: { in: ['p1'] } },
    });
    expect(models.stockPurchase.deleteMany).toHaveBeenCalled();
  });
});

describe('transition / closing lock / deleteRow', () => {
  it('SHOULD end, reopen AND discard under the purchase lock with an event', async () => {
    const ended = await setup.transition(
      'p1',
      'ENDED' as never,
      user,
      '0d6f6f0e-6a62-4d77-8d8e-3d6f0b1a1c11',
    );

    expect(ended.status).toBe('ENDED');
    expect(models.stockPurchase.update.mock.calls[0][0].data.ended_at).toBeInstanceOf(Date);
    await setup.transition('p1', 'OPEN' as never, user);
    expect(models.stockPurchase.update.mock.calls[1][0].data.ended_at).toBeNull();
    await setup.transition('p1', 'DISCARDED' as never, user);
    await setup.transition('p1', 'CLOSED' as never, user);
    expect(raws.$executeRaw).toHaveBeenCalledTimes(4);
  });

  it('SHOULD answer 409 WHEN the purchase to change does not exist', async () => {
    raws.$queryRaw.mockResolvedValue([]);

    await expect(setup.transition('p1', 'ENDED' as never, user)).rejects.toThrow(ConflictException);
  });

  it('SHOULD set AND clear the closing lock', async () => {
    await setup.setClosing('p1', user, at);
    expect(models.stockPurchase.update.mock.calls[0][0].data).toEqual({
      closing_at: at,
      closing_by: user,
    });
    await setup.setClosing('p1', null, at);
    expect(models.stockPurchase.update.mock.calls[1][0].data).toEqual({
      closing_at: null,
      closing_by: null,
    });
  });

  it('SHOULD delete a row AND report whether it existed; refuse WHEN not open', async () => {
    models.stockPurchaseRow.deleteMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    expect(await setup.deleteRow({ purchaseId: 'p1', rowId: 'r1', userId: user })).toBe(true);
    expect(await setup.deleteRow({ purchaseId: 'p1', rowId: 'r1', userId: user })).toBe(false);

    models.stockPurchase.findUnique.mockResolvedValue(rawPurchase({ status: 'ENDED' }));
    await expect(setup.deleteRow({ purchaseId: 'p1', rowId: 'r1', userId: user })).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('upsertRow', () => {
  const base = { purchaseId: 'p1', rowId: 'r1', userId: user };

  it('SHOULD create a row AND touch the purchase with an event', async () => {
    models.stockPurchaseRow.findUnique.mockResolvedValue(null);
    models.stockPurchaseRow.create.mockResolvedValue(rawRow());

    const result = await setup.upsertRow({
      ...base,
      description: 'Candle',
      quantity: 2,
      unit: 'unit' as never,
    });

    expect(result.convertedToOutside).toBe(false);
    expect(models.stockPurchaseRow.create.mock.calls[0][0].data).toMatchObject({
      checked_by: user,
      description: 'Candle',
      id: 'r1',
    });
  });

  it('SHOULD update the row WHEN it exists AND clear "Não sei"', async () => {
    models.stockPurchaseRow.findUnique.mockResolvedValue(rawRow());
    models.stockPurchaseRow.update.mockResolvedValue(rawRow({ quantity: 3 }));

    const result = await setup.upsertRow({ ...base, quantity: 3 });

    expect(result.row.quantity).toBe(3);
    expect(models.stockPurchaseRow.update.mock.calls[0][0].data.unknown_price).toBe(false);
  });

  it('SHOULD answer the stored row WHEN the client key was already applied', async () => {
    models.stockPurchaseEvent.findUnique.mockResolvedValue({ id: 1n });
    models.stockPurchaseRow.findUniqueOrThrow.mockResolvedValue(rawRow());

    const result = await setup.upsertRow({
      ...base,
      clientId: '0d6f6f0e-6a62-4d77-8d8e-3d6f0b1a1c11',
    });

    expect(result.row.id).toBe('r1');
    expect(models.stockPurchaseRow.create).not.toHaveBeenCalled();
  });

  it('SHOULD turn a list row taken by another purchase into an outside-the-list row (FR 18)', async () => {
    models.stockPurchaseRow.findUnique.mockResolvedValue(null);
    models.stockPurchaseRow.findFirst.mockResolvedValueOnce({
      checker: { name: 'Ana' },
      purchase_id: 'p2',
    });
    models.stockShoppingListRow.findUnique.mockResolvedValue({
      description: null,
      item_id: 'i1',
      unit: null,
    });
    models.stockPurchaseRow.create.mockResolvedValue(rawRow({ item_id: 'i1', list_row_id: null }));

    const result = await setup.upsertRow({ ...base, listRowId: 'l1', quantity: 1 });

    expect(result.convertedToOutside).toBe(true);
    expect(result.conflict).toEqual({ purchaseId: 'p2', userName: 'Ana' });
    expect(models.stockPurchaseRow.create.mock.calls[0][0].data).toMatchObject({
      item_id: 'i1',
      list_row_id: undefined,
    });
  });

  it('SHOULD sum the quantity into the row that already holds the item', async () => {
    models.stockPurchaseRow.findUnique.mockResolvedValue(null);
    models.stockPurchaseRow.findFirst.mockResolvedValue({ id: 'twin', quantity: 2 });
    models.stockPurchaseRow.update.mockResolvedValue(rawRow({ id: 'twin', quantity: 5 }));

    const result = await setup.upsertRow({ ...base, itemId: 'i1', quantity: 3 });

    expect(models.stockPurchaseRow.update.mock.calls[0][0].data.quantity).toBe(5);
    expect(result.row.id).toBe('twin');
  });

  it('SHOULD refuse (409) WHEN the purchase is not open', async () => {
    models.stockPurchase.findUnique.mockResolvedValue(rawPurchase({ status: 'ENDED' }));

    await expect(setup.upsertRow(base)).rejects.toThrow(ConflictException);
  });
});

describe('mergeInto', () => {
  it('SHOULD sum the twin rows, move the others AND discard the source', async () => {
    models.stockPurchase.findUniqueOrThrow.mockResolvedValue(rawPurchase());
    models.stockPurchaseRow.findMany
      .mockResolvedValueOnce([rawRow({ id: 't1', item_id: 'i1', purchase_id: 'b', quantity: 1 })])
      .mockResolvedValueOnce([
        rawRow({ id: 's1', item_id: 'i1', quantity: 2 }),
        rawRow({ id: 's2', item_id: 'i2', quantity: 1 }),
      ]);

    await setup.mergeInto('a', 'b', user);

    expect(models.stockPurchaseRow.update).toHaveBeenCalledWith({
      data: { quantity: 3 },
      where: { id: 't1' },
    });
    expect(models.stockPurchaseRow.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
    expect(models.stockPurchaseRow.update).toHaveBeenCalledWith({
      data: { purchase_id: 'b' },
      where: { id: 's2' },
    });
    expect(models.stockPurchase.update.mock.calls[0][0].data.status).toBe('DISCARDED');
  });
});

describe('close', () => {
  const params = {
    date: day('2026-11-18'),
    purchaseId: 'p1',
    receiptTotalCents: 1000,
    rows: [
      { lineTotalCents: 600, quantity: 2, rowId: 'r1' },
      { newItem: { description: 'Candle' }, quantity: 1, rowId: 'r2' },
    ],
    userId: user,
  };

  it('SHOULD write entries, finance link, history AND the list in one transaction', async () => {
    models.stockPurchaseRow.findMany
      .mockResolvedValueOnce([
        rawRow({ id: 'r1', item_id: 'i1', quantity: 2 }),
        rawRow({ id: 'r2', list_row_id: 'l2', quantity: 1 }),
      ])
      .mockResolvedValueOnce([
        rawRow({
          id: 'r1',
          item_id: 'i1',
          line_total_cents: 600,
          quantity: 2,
          unit_price_cents: 300,
        }),
      ]);
    models.stockPurchaseRow.update.mockImplementation(
      async ({ data, where }: { data: object; where: { id: string } }) =>
        rawRow({ id: where.id, ...(data as object), item_id: 'i1' }),
    );
    models.stockItem.create.mockResolvedValue({ id: 'new-item' });
    models.stockLot.findFirst
      .mockResolvedValueOnce({ id: 'lot1', quantity: 1 })
      .mockResolvedValueOnce(null);
    models.stockLot.create.mockResolvedValue({ id: 'lot2' });
    models.stockMovement.create.mockResolvedValue({ id: 'mv' });
    models.stockShoppingListRow.findUnique.mockResolvedValue({
      id: 'l2',
      item_id: null,
      origin: 'MANUAL',
      quantity: 1,
    });
    const post = jest.fn().mockResolvedValue({ splitId: 's1' });

    const result = await setup.close(params, post);

    expect(databaseMock.runInTransaction).toHaveBeenCalled();
    expect(post).toHaveBeenCalledTimes(1);
    expect(result.newItemIds).toEqual(['new-item']);
    expect(models.stockLot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          currency: 'BRL',
          leftover_dismissed_at: null,
          leftover_dismissed_quantity: null,
          quantity: 3,
          unit_price_cents: 300,
        },
        where: { id: 'lot1' },
      }),
    );
    expect(result.lots).toBe(1);
    expect(models.stockPriceHistory.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ item_id: 'i1', unit_price_cents: 300 }),
    ]);
    expect(models.financialSplit.update).toHaveBeenCalledWith({
      data: { stock_purchase_id: 'p1' },
      where: { id: 's1' },
    });
    expect(
      models.stockPurchase.update.mock.calls[models.stockPurchase.update.mock.calls.length - 1][0]
        .data,
    ).toMatchObject({
      split_id: 's1',
      status: 'CLOSED',
    });
  });

  it('SHOULD answer 409 WHEN the purchase is already closed', async () => {
    models.stockPurchase.findUnique.mockResolvedValue(rawPurchase({ status: 'CLOSED' }));

    await expect(setup.close(params, jest.fn())).rejects.toThrow(ConflictException);
  });
});

describe('updateClosed', () => {
  it('SHOULD update prices, repost finance AND rewrite the history', async () => {
    models.stockPurchase.findUnique.mockResolvedValue(rawPurchase({ status: 'CLOSED' }));
    models.stockPurchaseRow.findMany.mockResolvedValue([
      rawRow({ item_id: 'i1', line_total_cents: 900, unit_price_cents: 450 }),
    ]);
    const repost = jest.fn().mockResolvedValue({ transactionId: 't1' });

    const result = await setup.updateClosed(
      {
        purchaseId: 'p1',
        rowPrices: [{ lineTotalCents: 900, rowId: 'r1', unitPriceCents: 450 }],
        userId: user,
      },
      repost,
    );

    expect(repost).toHaveBeenCalled();
    expect(models.financialTransaction.update).toHaveBeenCalledWith({
      data: { stock_purchase_id: 'p1' },
      where: { id: 't1' },
    });
    expect(models.stockPriceHistory.deleteMany).toHaveBeenCalledWith({
      where: { purchase_id: 'p1' },
    });
    expect(result.rows).toHaveLength(1);
  });

  it('SHOULD rewrite the price of the ENTRY and reprice the lot it fed (spec 123 FR 26)', async () => {
    models.stockPurchase.findUnique.mockResolvedValue(rawPurchase({ status: 'CLOSED' }));
    models.stockPurchaseRow.findMany.mockResolvedValue([
      rawRow({
        entry_movement_id: 'mv1',
        item_id: 'i1',
        line_total_cents: 900,
        unit_price_cents: 450,
      }),
    ]);
    models.stockMovement.update.mockResolvedValue({ lot_id: 'lot1' });

    await setup.updateClosed(
      {
        purchaseId: 'p1',
        rowPrices: [{ lineTotalCents: 900, rowId: 'r1', unitPriceCents: 450 }],
        userId: user,
      },
      jest.fn().mockResolvedValue({}),
    );

    expect(models.stockMovement.update).toHaveBeenCalledWith({
      data: { currency: 'BRL', unit_price_cents: 450 },
      select: { lot_id: true },
      where: { id: 'mv1' },
    });
    // the weighted average of the priced entries, then the lots left without a priced entry
    expect(raws.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('SHOULD answer 409 WHEN the purchase is not closed', async () => {
    await expect(setup.updateClosed({ purchaseId: 'p1', userId: user }, jest.fn())).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('deleteClosed', () => {
  it('SHOULD undo the untouched entries, keep the used ones AND cancel the finance posting', async () => {
    models.stockPurchase.findUnique.mockResolvedValue(
      rawPurchase({ split_id: 's1', status: 'CLOSED' }),
    );
    models.stockPurchaseRow.findMany
      .mockResolvedValueOnce([
        rawRow({ entry_movement_id: 'mv1', id: 'r1' }),
        rawRow({ entry_movement_id: 'mv2', id: 'r2' }),
        rawRow({ entry_movement_id: 'mv3', id: 'r3' }),
      ])
      .mockResolvedValueOnce([
        { entry_movement: { created_at: at, id: 'mv1', lot_id: 'lot1' }, id: 'r1' },
        { entry_movement: { created_at: at, id: 'mv2', lot_id: 'lot2' }, id: 'r2' },
        { entry_movement: { created_at: at, id: 'mv3', lot_id: 'lot3' }, id: 'r3' },
      ]);
    models.stockMovement.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    models.stockMovement.findUnique
      .mockResolvedValueOnce({ id: 'mv2', item_id: 'i2', lot_id: 'lot2', quantity: 2 })
      .mockResolvedValueOnce({ id: 'mv3', item_id: 'i3', lot_id: 'lot3', quantity: 1 });
    models.stockLot.findUniqueOrThrow
      .mockResolvedValueOnce({ id: 'lot2', quantity: 5 })
      .mockResolvedValueOnce({ id: 'lot3', quantity: 1 });
    const cancel = jest.fn();

    const result = await setup.deleteClosed('p1', user, cancel);

    expect(result.kept.map((row) => row.id)).toEqual(['r1']);
    expect(models.stockLot.update).toHaveBeenCalledWith({
      data: { quantity: 3 },
      where: { id: 'lot2' },
    });
    expect(models.stockLot.delete).toHaveBeenCalledWith({ where: { id: 'lot3' } });
    expect(cancel).toHaveBeenCalledWith({ splitId: 's1', transactionId: undefined });
    expect(models.stockPurchase.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it('SHOULD answer 409 WHEN the purchase is not closed', async () => {
    await expect(setup.deleteClosed('p1', user, jest.fn())).rejects.toThrow(ConflictException);
  });
});

describe('upsertRow from a list row', () => {
  it('SHOULD copy the item of the list row into the new purchase row', async () => {
    models.stockPurchaseRow.findUnique.mockResolvedValue(null);
    models.stockPurchaseRow.findFirst.mockResolvedValue(null);
    models.stockShoppingListRow.findUnique.mockResolvedValue({
      description: null,
      item_id: 'i9',
      unit: null,
    });
    models.stockPurchaseRow.create.mockResolvedValue(rawRow({ item_id: 'i9', list_row_id: 'l1' }));

    await setup.upsertRow({
      listRowId: 'l1',
      purchaseId: 'p1',
      quantity: 1,
      rowId: 'r1',
      userId: user,
    });

    expect(models.stockPurchaseRow.create.mock.calls[0][0].data).toMatchObject({
      item_id: 'i9',
      list_row_id: 'l1',
    });
  });
});

describe('close with a barcode (spec 121 FR 26)', () => {
  const params = {
    date: day('2026-11-18'),
    purchaseId: 'p1',
    receiptTotalCents: 1000,
    rows: [{ newItem: { description: 'Candle' }, quantity: 1, rowId: 'r2' }],
    userId: user,
  };

  async function close() {
    models.stockPurchaseRow.findMany
      .mockResolvedValueOnce([rawRow({ barcode: '7891000100103', id: 'r2', quantity: 1 })])
      .mockResolvedValueOnce([]);
    models.stockPurchaseRow.update.mockImplementation(
      async ({ data, where }: { data: object; where: { id: string } }) =>
        rawRow({ id: where.id, ...(data as object) }),
    );
    models.stockItem.create.mockResolvedValue({ id: 'new-item' });
    models.stockLot.findFirst.mockResolvedValue(null);
    models.stockLot.create.mockResolvedValue({ id: 'lot' });
    models.stockMovement.create.mockResolvedValue({ id: 'mv' });

    return setup.close(params, jest.fn().mockResolvedValue({}));
  }

  it('SHOULD create the item WITH the code WHEN the owner has no item with it', async () => {
    models.stockItem.findFirst.mockResolvedValue(null);

    const result = await close();

    expect(result.newItemIds).toEqual(['new-item']);
    expect(models.stockItem.create.mock.calls[0][0].data).toMatchObject({
      barcode: '7891000100103',
    });
  });

  it('SHOULD link the row to the existing item instead of a duplicate WHEN the code is taken', async () => {
    models.stockItem.findFirst.mockResolvedValue({ id: 'existing' });

    const result = await close();

    expect(result.newItemIds).toEqual([]);
    expect(models.stockItem.create).not.toHaveBeenCalled();
    expect(models.stockPurchaseRow.update.mock.calls[0][0].data).toMatchObject({
      item_id: 'existing',
    });
  });
});
