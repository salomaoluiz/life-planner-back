import { mocks, setup } from './purchase.controller.mocks';

const { id, key, notifier, request, result, rowId, service, userId } = mocks;
let controllers: Awaited<ReturnType<typeof setup>>;

beforeEach(async () => {
  controllers = await setup();
});

describe('markets', () => {
  it('SHOULD list, create AND update markets (strict bodies)', async () => {
    const { markets } = controllers;

    expect(await markets.findAll(request, { includeArchived: 'true' })).toBe(result);
    expect(service.findMarkets).toHaveBeenCalledWith(userId, {
      includeArchived: true,
      ownerId: undefined,
    });
    await markets.create(request, { name: 'Bom Preço', owner: 'USER', ownerId: id } as never);
    expect(service.createMarket).toHaveBeenCalledWith(userId, {
      name: 'Bom Preço',
      owner: 'USER',
      ownerId: id,
    });
    await markets.update(request, id, { status: 'ARCHIVED' } as never);
    expect(service.updateMarket).toHaveBeenCalledWith(userId, id, { status: 'ARCHIVED' });
    expect(async () => markets.update(request, id, {} as never)).rejects.toBeDefined();
  });
});

describe('purchases', () => {
  it('SHOULD start a purchase with 201, or 200 WHEN it already existed', async () => {
    const response = { status: jest.fn() };

    service.start.mockResolvedValueOnce({ created: true, purchase: { id } });
    await controllers.purchases.create(
      request,
      { id, listId: id, marketId: id, purchaseDate: '2026-11-18' } as never,
      response,
    );
    expect(response.status).not.toHaveBeenCalled();

    service.start.mockResolvedValueOnce({ created: false, purchase: { id } });
    expect(
      await controllers.purchases.create(
        request,
        { id, listId: id, marketId: id, purchaseDate: '2026-11-18' } as never,
        response,
      ),
    ).toEqual({ id });
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('SHOULD end, reopen AND discard passing a valid idempotency key only', async () => {
    const { purchases } = controllers;

    await purchases.end(request, id, key);
    await purchases.reopen(request, id, 'not-a-uuid');
    await purchases.discard(request, id);
    expect(service.changeStatus).toHaveBeenNthCalledWith(1, userId, id, 'END', key);
    expect(service.changeStatus).toHaveBeenNthCalledWith(2, userId, id, 'REOPEN', undefined);
    expect(service.changeStatus).toHaveBeenNthCalledWith(3, userId, id, 'DISCARD', undefined);
  });

  it('SHOULD find, merge AND release or take the closing lock', async () => {
    const { purchases } = controllers;

    await purchases.findById(request, id);
    await purchases.merge(request, id, rowId);
    await purchases.closing(request, id);
    await purchases.closingRelease(request, id);
    expect(service.findPurchase).toHaveBeenCalledWith(userId, id);
    expect(service.merge).toHaveBeenCalledWith(userId, id, rowId);
    expect(service.closingLock).toHaveBeenNthCalledWith(1, userId, id, false);
    expect(service.closingLock).toHaveBeenNthCalledWith(2, userId, id, true);
  });

  it('SHOULD upsert AND remove a row with the key', async () => {
    await controllers.purchases.upsertRow(request, id, rowId, { quantity: 2 } as never, key);
    expect(service.upsertRow).toHaveBeenCalledWith(userId, id, rowId, { quantity: 2 }, key);
    await controllers.purchases.removeRow(request, id, rowId, key);
    expect(service.removeRow).toHaveBeenCalledWith(userId, id, rowId, key);
  });

  it('SHOULD preview, close (language AND key) AND edit AND delete a closed purchase', async () => {
    const { purchases } = controllers;
    const body = { date: '2026-11-18', receiptTotalCents: 1000, rows: [] };

    await purchases.closePreview(request, id, { receiptTotalCents: '1000' });
    expect(service.closePreview).toHaveBeenCalledWith(userId, id, 1000);
    await purchases.close(request, id, body as never, 'en-US,en;q=0.9', key);
    expect(service.close).toHaveBeenCalledWith(userId, id, body, 'en-US', key);
    await purchases.update(request, id, { receiptTotalCents: 900 } as never);
    expect(service.updateClosed).toHaveBeenCalledWith(userId, id, { receiptTotalCents: 900 });
    await purchases.remove(request, id);
    expect(service.deleteClosed).toHaveBeenCalledWith(userId, id);
  });

  it('SHOULD answer the pending purchases, the list purchases AND the item prices', async () => {
    await controllers.pending.pending(request);
    await controllers.lists.findAll(request, id, { status: 'CLOSED' });
    await controllers.items.prices(request, id, { limit: '10' });
    expect(service.pending).toHaveBeenCalledWith(userId);
    expect(service.listPurchases).toHaveBeenCalledWith(userId, id, {
      cursor: undefined,
      limit: undefined,
      status: ['CLOSED'],
    });
    expect(service.itemPrices).toHaveBeenCalledWith(userId, id, {
      cursor: undefined,
      limit: 10,
      marketId: undefined,
    });
  });
});

describe('event stream', () => {
  function response() {
    const handlers: Record<string, () => void> = {};

    return {
      end: jest.fn(),
      flushHeaders: jest.fn(),
      handlers,
      on: jest.fn((event: string, handler: () => void) => {
        handlers[event] = handler;
      }),
      setHeader: jest.fn(),
      write: jest.fn(),
    };
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('SHOULD open the stream with the event-stream headers AND skip what already happened', async () => {
    const res = response();

    service.events.mockResolvedValueOnce([{ id: 4n }]).mockResolvedValue([]);
    await controllers.events.stream(request, id, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
    expect(res.write).not.toHaveBeenCalled();
    expect(notifier.subscribe).toHaveBeenCalledWith('stock_list_events', expect.any(Function));
  });

  it('SHOULD replay the events after Last-Event-ID', async () => {
    const res = response();

    service.events.mockResolvedValue([
      { id: 5n, payload: { a: 1 }, purchaseId: 'p1', type: 'row.upserted' },
    ]);
    await controllers.events.stream(request, id, res, '4');

    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('id: 5\nevent: row.upserted'));
    expect(service.events).toHaveBeenCalledWith(userId, id, 4n);
  });

  it('SHOULD ask for a resync WHEN the replay page is full', async () => {
    const res = response();

    service.events.mockResolvedValue(
      Array.from({ length: 500 }, (_, index) => ({
        id: BigInt(index + 1),
        payload: {},
        purchaseId: 'p',
        type: 't',
      })),
    );
    await controllers.events.stream(request, id, res, '0');

    expect(res.write).toHaveBeenCalledWith('event: resync\ndata: {}\n\n');
  });

  it('SHOULD push new events WHEN a notification of the list arrives AND ignore other lists', async () => {
    const res = response();

    service.events.mockResolvedValue([]);
    await controllers.events.stream(request, id, res);
    service.events.mockResolvedValue([
      { id: 9n, payload: {}, purchaseId: 'p', type: 'purchase.ended' },
    ]);

    const listener = notifier.subscribe.mock.calls[0][1] as (payload: string) => void;

    listener(JSON.stringify({ id: 9, listId: 'other' }));
    listener('not json');
    await jest.advanceTimersByTimeAsync(0);
    expect(res.write).not.toHaveBeenCalled();

    listener(JSON.stringify({ id: 9, listId: id }));
    await jest.advanceTimersByTimeAsync(0);
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('event: purchase.ended'));
  });

  it('SHOULD heartbeat, close after 30 minutes AND stop listening WHEN the client leaves', async () => {
    const res = response();
    const stop = jest.fn();

    notifier.subscribe.mockResolvedValue(stop);
    service.events.mockResolvedValue([]);
    await controllers.events.stream(request, id, res);

    await jest.advanceTimersByTimeAsync(25_000);
    expect(res.write).toHaveBeenCalledWith(': ping\n\n');

    await jest.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(res.end).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();

    const other = response();

    await controllers.events.stream(request, id, other);
    other.handlers.close();
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it('SHOULD close the stream WHEN the access check fails later', async () => {
    const res = response();

    service.events.mockResolvedValueOnce([]);
    await controllers.events.stream(request, id, res);
    service.events.mockRejectedValue(new Error('404'));
    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(res.end).toHaveBeenCalled();
  });
});
