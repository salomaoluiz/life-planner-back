import {
  decodeCursor,
  encodeCursor,
  toMarketOutput,
  toPurchaseHeader,
  toPurchaseViewOutput,
} from './purchase.service';
import {
  familyId,
  market,
  owners,
  purchase,
  purchaseRow,
  setup,
  useCases,
  userId,
  view,
} from './purchase.service.mocks';

const day = new Date('2026-11-18T00:00:00.000Z');

describe('cursor codec / mappers', () => {
  it('SHOULD round-trip a cursor AND ignore a broken one', () => {
    expect(decodeCursor(encodeCursor({ id: 'a' }))).toEqual({ id: 'a' });
    expect(decodeCursor('%%%')).toBeUndefined();
    expect(decodeCursor()).toBeUndefined();
  });

  it('SHOULD map the market, the header AND the view without undefined fields', () => {
    expect(toMarketOutput(market('m1'))).toMatchObject({ id: 'm1', neighborhood: null });
    expect(
      toPurchaseHeader(purchase('p1', { closingAt: day, closingBy: 'u', purchaseDate: day })),
    ).toMatchObject({
      closing: { at: day.toISOString(), by: 'u' },
      purchaseDate: '2026-11-18',
      splitId: null,
    });
    expect(toPurchaseViewOutput(view as never).rows[0]).toMatchObject({
      expirationDate: null,
      lastPrice: null,
      quantity: 2,
    });
  });
});

describe('access', () => {
  it('SHOULD read the markets of the user AND the families they joined', async () => {
    useCases.getMarkets.execute.mockResolvedValue([market('m1')]);

    const result = await setup.findMarkets(userId, { includeArchived: false });

    expect(result.items).toHaveLength(1);
    expect(useCases.getMarkets.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        accessibleOwners: [
          { owner: 'USER', ownerId: userId },
          { archived: false, owner: 'FAMILY', ownerId: familyId },
        ],
      }),
    );
  });
});

describe('simple pass-throughs', () => {
  it('SHOULD start, find, change status, merge AND lock', async () => {
    useCases.start.execute.mockResolvedValue({ created: true, purchase: purchase('p1') });
    useCases.getPurchase.execute.mockResolvedValue(view);
    useCases.changeStatus.execute.mockResolvedValue(purchase('p1'));
    useCases.merge.execute.mockResolvedValue(purchase('p1'));
    useCases.closingLock.execute.mockResolvedValue({ closingAt: day, closingBy: userId });

    expect(
      (
        await setup.start(userId, {
          id: 'p1',
          listId: 'l',
          marketId: 'm',
          purchaseDate: '2026-11-18',
        })
      ).created,
    ).toBe(true);
    expect((await setup.findPurchase(userId, 'p1')).cart.count).toBe(1);
    expect((await setup.changeStatus(userId, 'p1', 'END', 'key')).id).toBe('p1');
    expect(useCases.changeStatus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'END', clientId: 'key' }),
    );
    expect((await setup.merge(userId, 'p1', 'p2')).id).toBe('p1');
    expect(await setup.closingLock(userId, 'p1', false)).toEqual({
      closingAt: day.toISOString(),
      closingBy: userId,
    });
    useCases.closingLock.execute.mockResolvedValue({});
    expect(await setup.closingLock(userId, 'p1', true)).toEqual({
      closingAt: null,
      closingBy: null,
    });
  });

  it('SHOULD create AND update a market, upsert AND remove a row, read events, pending AND prices', async () => {
    useCases.createMarket.execute.mockResolvedValue(market('m1'));
    useCases.updateMarket.execute.mockResolvedValue(market('m1'));
    useCases.upsertRow.execute.mockResolvedValue({
      conflict: undefined,
      convertedToOutside: false,
      row: { ...view.rows[0], checkedAt: day },
    });
    useCases.events.execute.mockResolvedValue([{ id: 1n }]);
    useCases.pending.execute.mockResolvedValue([
      {
        cartTotalCents: 1,
        checkedCount: 1,
        id: 'p',
        lastActivityAt: day,
        listId: 'l',
        listName: 'L',
        marketName: 'M',
        status: 'ENDED',
      },
    ]);
    useCases.prices.execute.mockResolvedValue({
      items: [{ date: day, id: 'h1', marketId: 'm', unitPriceCents: 100 }],
      nextCursor: { date: day, id: 'h1' },
    });

    expect(
      (await setup.createMarket(userId, { name: 'x', owner: 'USER' as never, ownerId: userId })).id,
    ).toBe('m1');
    expect((await setup.updateMarket(userId, 'm1', { name: 'y' })).id).toBe('m1');
    expect((await setup.upsertRow(userId, 'p1', 'r1', { quantity: 2 }, 'key')).conflict).toBeNull();
    await setup.removeRow(userId, 'p1', 'r1', 'key');
    expect(useCases.deleteRow.execute).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'key', rowId: 'r1' }),
    );
    expect(await setup.events(userId, 'l', 0n)).toEqual([{ id: 1n }]);
    expect((await setup.pending(userId)).items[0].lastActivityAt).toBe(day.toISOString());
    const prices = await setup.itemPrices(userId, 'i1', {
      cursor: encodeCursor({ date: day.toISOString(), id: 'h0' }),
    });

    expect(prices.items[0].date).toBe('2026-11-18');
    expect(decodeCursor(prices.nextCursor as string)).toEqual({ date: '2026-11-18', id: 'h1' });
  });

  it('SHOULD list closed purchases with a cursor AND the open ones as views', async () => {
    useCases.listPurchases.execute.mockResolvedValueOnce({
      closed: { items: [purchase('p1')], nextCursor: { closedAt: day, id: 'p1' } },
    });
    useCases.listPurchases.execute.mockResolvedValueOnce({ open: [view] });

    const closed = await setup.listPurchases(userId, 'l', { status: ['CLOSED'] });

    expect(closed.nextCursor).not.toBeNull();
    expect((await setup.listPurchases(userId, 'l', { status: ['OPEN'] })).items).toHaveLength(1);
  });

  it('SHOULD answer the close preview with nullable fields', async () => {
    useCases.closePreview.execute.mockResolvedValue({
      expirations: [{ rowId: 'r', suggestedDate: day }],
      financeError: undefined,
      financeParts: [{ categoryId: undefined, kind: 'ADJUSTMENT', valueCents: -100 }],
      missingPrices: [],
      needsDefaultFinanceCategory: false,
      newItems: [{ description: 'x', rowId: 'r', suggestion: null, unit: undefined }],
      unknownWeight: [],
    });

    const result = await setup.closePreview(userId, 'p1', 500);

    expect(result.financeParts?.[0].categoryId).toBeNull();
    expect(result.expirations[0].suggestedDate).toBe('2026-11-18');
  });
});

describe('closing posts to finance', () => {
  const posting = {
    accountId: 'account-id',
    currency: 'BRL',
    date: day,
    description: 'Compra no X',
    noPriceLabel: 'Sem preço',
    owner: 'USER',
    ownerId: userId,
    total: 1000,
  };

  async function close(parts: object[]) {
    useCases.close.execute.mockImplementation(
      async (_input: unknown, post: (p: unknown) => Promise<unknown>) => {
        const reference = await post({ ...posting, parts });

        return {
          lots: 1,
          newItemIds: [],
          purchase: purchase('p1'),
          reference,
          removedRows: 0,
          updatedRows: 0,
        };
      },
    );

    return setup.close(
      userId,
      'p1',
      { date: '2026-11-18', receiptTotalCents: 1000, rows: [] },
      'en-US',
      'key',
    );
  }

  it('SHOULD post ONE split WHEN there are two or more parts (the adjustment by system key)', async () => {
    useCases.createSplit.execute.mockResolvedValue({ id: 'split-1' });

    const result = await close([
      { categoryId: 'cat', kind: 'CATEGORY', valueCents: 1100 },
      { kind: 'ADJUSTMENT', valueCents: -100 },
    ]);

    expect(result.splitId).toBe('split-1');
    expect(useCases.createSplit.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        paid: true,
        parts: [
          expect.objectContaining({ categoryId: 'cat', type: 'EXPENSE', value: 1100 }),
          expect.objectContaining({ systemKey: 'SPLIT_ADJUSTMENT', value: -100 }),
        ],
        total: 1000,
      }),
    );
  });

  it('SHOULD label the "no price" part AND post a simple transaction WHEN one part is left', async () => {
    useCases.createSplit.execute.mockResolvedValue({ id: 'split-1' });
    await close([
      { categoryId: 'cat', kind: 'CATEGORY', valueCents: 500 },
      { categoryId: 'cat', kind: 'NO_PRICE', valueCents: 500 },
    ]);
    expect(useCases.createSplit.execute.mock.calls[0][0].parts[1].description).toBe('Sem preço');

    useCases.createTransaction.execute.mockResolvedValue({ transaction: { id: 'tx-1' } });
    const result = await close([{ categoryId: 'cat', kind: 'CATEGORY', valueCents: 1000 }]);

    expect(result.transactionId).toBe('tx-1');
    expect(useCases.createTransaction.execute).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat', owner: 'USER', value: 1000 }),
    );
  });

  it('SHOULD leave a card source unpaid (the invoice decides)', async () => {
    useCases.createTransaction.execute.mockResolvedValue({ transaction: { id: 'tx-1' } });
    useCases.close.execute.mockImplementation(
      async (_input: unknown, post: (p: unknown) => Promise<unknown>) => {
        await post({
          ...posting,
          accountId: undefined,
          creditCardId: 'card',
          invoiceMonth: '2026-12',
          parts: [{ categoryId: 'c', kind: 'CATEGORY', valueCents: 1000 }],
        });

        return {
          lots: 0,
          newItemIds: [],
          purchase: purchase('p1'),
          reference: {},
          removedRows: 0,
          updatedRows: 0,
        };
      },
    );

    await setup.close(userId, 'p1', { date: '2026-11-18', receiptTotalCents: 1000, rows: [] });

    expect(useCases.createTransaction.execute.mock.calls[0][0]).toMatchObject({
      creditCardId: 'card',
      invoiceMonth: '2026-12',
      paid: undefined,
    });
  });
});

describe('closed purchase edit and delete', () => {
  it('SHOULD delete the old posting AND create the new one when editing', async () => {
    useCases.updateClosed.execute.mockImplementation(
      async (_input: unknown, repost: (p: unknown) => Promise<unknown>) => {
        await repost({
          accountId: 'a',
          currency: 'BRL',
          date: day,
          description: 'x',
          noPriceLabel: 'n',
          owner: 'USER',
          ownerId: userId,
          parts: [{ categoryId: 'c', kind: 'CATEGORY', valueCents: 100 }],
          splitId: 'old-split',
          total: 100,
          transactionId: 'old-tx',
        });

        return { purchase: purchase('p1'), rows: [] };
      },
    );
    useCases.createTransaction.execute.mockResolvedValue({ transaction: { id: 'tx-2' } });

    await setup.updateClosed(userId, 'p1', { receiptTotalCents: 100 });

    expect(useCases.deleteSplit.execute).toHaveBeenCalledWith(
      expect.objectContaining({ fromStockPurchase: true, id: 'old-split' }),
    );
    expect(useCases.deleteTransaction.execute).toHaveBeenCalledWith(
      expect.objectContaining({ fromStockPurchase: true, id: 'old-tx' }),
    );
  });

  it('SHOULD cancel the finance posting AND report the kept rows when deleting', async () => {
    useCases.deleteClosed.execute.mockImplementation(
      async (_input: unknown, cancel: (r: unknown) => Promise<void>) => {
        await cancel({ splitId: 's', transactionId: 't' });
        await cancel({});

        return { kept: [purchaseRow('r1', { description: 'Candle' })] };
      },
    );

    const result = await setup.deleteClosed(userId, 'p1');

    expect(result.keptRows).toEqual([{ description: 'Candle', rowId: 'r1' }]);
    expect(useCases.deleteSplit.execute).toHaveBeenCalledWith(
      expect.objectContaining({ fromStockPurchase: true, id: 's' }),
    );
    expect(useCases.deleteTransaction.execute).toHaveBeenCalledWith(
      expect.objectContaining({ fromStockPurchase: true, id: 't' }),
    );
    expect(owners).toHaveLength(2);
  });
});
