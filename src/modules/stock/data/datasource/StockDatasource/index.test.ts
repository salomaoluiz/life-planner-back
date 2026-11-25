import { mocks, setup, spies } from './index.mocks';

const base = {
  description: 'Rice',
  owner: 'USER' as const,
  owner_id: 'owner',
  stock_only: false,
  unit: 'kilogram' as const,
  user_id: 'user',
  warn_days_closed: 7,
  warn_days_opened: 1,
};

describe('Method create', () => {
  it('SHOULD insert the item, its first lot and an ENTRY (MANUAL) movement in one transaction', async () => {
    spies.stockCreate.mockResolvedValue(mocks.stock);
    spies.lotCreate.mockResolvedValue(mocks.lot);

    const result = await setup.create({ ...base, first_lot: { quantity: 2 } });

    expect(spies.stockCreate).toHaveBeenCalledWith({
      data: expect.not.objectContaining({
        first_lot: expect.anything(),
        user_id: expect.anything(),
      }),
    });
    expect(spies.lotCreate).toHaveBeenCalledWith({
      data: { item_id: mocks.stock.id, quantity: 2 },
    });
    expect(spies.movementCreate).toHaveBeenCalledWith({
      data: {
        item_id: mocks.stock.id,
        lot_id: 'lot',
        quantity: 2,
        reason: 'MANUAL',
        type: 'ENTRY',
        user_id: 'user',
      },
    });
    expect(result.lots).toEqual([mocks.lot]);
    expect(spies.sync).toHaveBeenCalledWith(expect.anything(), [mocks.stock.id]);
  });

  it.each([
    ['no first lot', undefined],
    ['a zero first lot', { quantity: 0 }],
  ])('SHOULD create only the item WHEN there is %s', async (_label, firstLot) => {
    spies.stockCreate.mockResolvedValue(mocks.stock);

    const result = await setup.create({ ...base, first_lot: firstLot });

    expect(result.lots).toEqual([]);
    expect(spies.lotCreate).not.toHaveBeenCalled();
  });
});

describe('Method delete / deleteByOwner / exists', () => {
  it('SHOULD deleteMany by id so a row that is already gone does not throw', async () => {
    spies.stockDeleteMany.mockResolvedValue({ count: 0 });

    await expect(setup.delete('x')).resolves.toBeUndefined();
    expect(spies.stockDeleteMany).toHaveBeenCalledWith({ where: { id: 'x' } });
  });

  it('SHOULD return the rows deleted for an owner', async () => {
    spies.stockDeleteMany.mockResolvedValue({ count: 4 });

    expect(await setup.deleteByOwner({ owner: 'FAMILY', owner_id: 'f' })).toBe(4);
    expect(spies.stockDeleteMany).toHaveBeenCalledWith({
      where: { owner: 'FAMILY', owner_id: 'f' },
    });
  });

  it.each([
    [{ id: 'x' }, true],
    [null, false],
  ])('SHOULD report existence for %j', async (found, expected) => {
    spies.stockFindFirst.mockResolvedValue(found);

    expect(await setup.exists({ owner: 'USER', owner_id: 'u' })).toBe(expected);
  });
});

describe('Method findById', () => {
  it('SHOULD load the item with its lots that still have quantity', async () => {
    spies.stockFindUnique.mockResolvedValue({ ...mocks.stock, lots: [] });

    await setup.findById('x');

    expect(spies.stockFindUnique).toHaveBeenCalledWith({
      include: { lots: { orderBy: { id: 'asc' }, where: { quantity: { gt: 0 } } } },
      where: { id: 'x' },
    });
  });
});

describe('Method findByOwners', () => {
  it('SHOULD return [] WITHOUT reading lots WHEN there are no items', async () => {
    spies.stockFindMany.mockResolvedValue([]);

    expect(await setup.findByOwners(mocks.owners)).toEqual([]);
    expect(spies.lotFindMany).not.toHaveBeenCalled();
  });

  it('SHOULD read the items, then the open lots of those items once, AND apply the filters', async () => {
    spies.stockFindMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    spies.lotFindMany.mockResolvedValue([
      { id: 'l1', item_id: 'a' },
      { id: 'l2', item_id: 'a' },
    ]);

    const result = await setup.findByOwners(mocks.owners, {
      category_ids: ['c'],
      location_ids: ['l'],
    });

    expect(spies.stockFindMany).toHaveBeenCalledWith({
      orderBy: { id: 'asc' },
      where: expect.objectContaining({ category_id: { in: ['c'] }, location_id: { in: ['l'] } }),
    });
    expect(spies.lotFindMany).toHaveBeenCalledTimes(1);
    expect(result.map((row) => row.lots.length)).toEqual([2, 0]);
  });
});

describe('Method findMovements', () => {
  it('SHOULD read newest first', async () => {
    await setup.findMovements('item', 31);

    expect(spies.movementFindMany).toHaveBeenCalledWith({
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: 31,
      where: { item_id: 'item' },
    });
  });

  it('SHOULD continue strictly after the cursor (keyset)', async () => {
    const createdAt = new Date('2026-11-10T00:00:00.000Z');

    await setup.findMovements('item', 31, { createdAt, id: 'm' });

    expect(spies.movementFindMany.mock.calls[0][0].where).toEqual({
      item_id: 'item',
      OR: [{ created_at: { lt: createdAt } }, { created_at: createdAt, id: { lt: 'm' } }],
    });
  });
});

describe('Method update', () => {
  it('SHOULD pass the columns through (undefined = unchanged, null = clear) AND keep the lots', async () => {
    spies.stockUpdate.mockResolvedValue({ ...mocks.stock, lots: [] });
    spies.stockFindUniqueOrThrow.mockResolvedValue({ ...mocks.stock, lots: [] });

    await setup.update({ id: 'x', min_quantity: null, notes: 'n' });

    expect(spies.stockUpdate).toHaveBeenCalledWith({
      data: { min_quantity: null, notes: 'n' },
      where: { id: 'x' },
    });
    expect(spies.stockFindUniqueOrThrow).toHaveBeenCalledWith({
      include: expect.any(Object),
      where: { id: 'x' },
    });
    expect(spies.sync).toHaveBeenCalledWith(expect.anything(), ['x']);
    expect(spies.executeRaw).not.toHaveBeenCalled();
  });

  it('SHOULD turn the rows of the item into text rows WHEN the owner changes, before the sync', async () => {
    spies.stockFindUniqueOrThrow.mockResolvedValue({ ...mocks.stock, lots: [] });

    await setup.update({ id: 'x', owner: 'FAMILY', owner_id: 'f' });

    expect(spies.executeRaw).toHaveBeenCalledTimes(1);
    expect(spies.sync).toHaveBeenCalledWith(expect.anything(), ['x']);
  });
});

describe('Method applyMovement', () => {
  beforeEach(() => {
    spies.queryRaw.mockResolvedValue([{ id: 'item' }]);
    spies.stockFindUniqueOrThrow.mockResolvedValue({ ...mocks.stock, lots: [] });
    spies.lotFindMany.mockResolvedValue([mocks.lot]);
    spies.lotCreate.mockResolvedValue({ id: 'new-lot' });
    spies.movementCreate.mockImplementation(async ({ data }) => ({ ...mocks.movement, ...data }));
  });

  it('SHOULD lock the item row FIRST and give the planner the item and every lot', async () => {
    const planner = jest.fn().mockReturnValue([]);

    await setup.applyMovement('item', 'user', planner);

    expect(spies.queryRaw).toHaveBeenCalledTimes(1);
    expect(spies.lotFindMany).toHaveBeenCalledWith({
      orderBy: { id: 'asc' },
      where: { item_id: 'item' },
    });
    expect(planner).toHaveBeenCalledWith(expect.objectContaining({ id: mocks.stock.id }), [
      mocks.lot,
    ]);
  });

  it('SHOULD return null WHEN the item no longer exists, without planning', async () => {
    spies.queryRaw.mockResolvedValue([]);
    const planner = jest.fn();

    expect(await setup.applyMovement('item', 'user', planner)).toBeNull();
    expect(planner).not.toHaveBeenCalled();
  });

  it('SHOULD update lots, create lots and record movements with the author, in order', async () => {
    const result = await setup.applyMovement('item', 'user', () => [
      { lot: { id: 'lot' }, update: { quantity: 1 } },
      {
        lot: { create: { opened_at: new Date('2026-11-10'), quantity: 1 } },
        movement: { quantity: 1, type: 'OPEN' },
      },
      { lot: { id: 'lot' }, movement: { quantity: -1, reason: 'EXPIRED', type: 'DISCARD' } },
    ]);

    expect(spies.lotUpdate).toHaveBeenCalledWith({ data: { quantity: 1 }, where: { id: 'lot' } });
    expect(spies.lotCreate).toHaveBeenCalledWith({
      data: { item_id: 'item', opened_at: new Date('2026-11-10'), quantity: 1 },
    });
    expect(spies.movementCreate.mock.calls.map((call) => call[0].data)).toEqual([
      { item_id: 'item', lot_id: 'new-lot', quantity: 1, type: 'OPEN', user_id: 'user' },
      {
        item_id: 'item',
        lot_id: 'lot',
        quantity: -1,
        reason: 'EXPIRED',
        type: 'DISCARD',
        user_id: 'user',
        value_source: 'NONE',
      },
    ]);
    expect(result?.movements).toHaveLength(2);
    expect(result?.item.id).toBe(mocks.stock.id);
    // A lowering movement (negative quantity) also clears the dismissal of a removed row (spec 118 FR 11).
    expect(spies.sync).toHaveBeenCalledWith(expect.anything(), ['item'], { clearDismissal: true });
  });

  it('SHOULD keep the dismissal WHEN no movement lowers the quantity AND skip the sync on a replay', async () => {
    await setup.applyMovement('item', 'user', () => [
      { lot: { id: 'lot' }, movement: { quantity: 2, type: 'ENTRY' }, update: { quantity: 4 } },
    ]);
    expect(spies.sync).toHaveBeenCalledWith(expect.anything(), ['item'], { clearDismissal: false });

    spies.sync.mockClear();
    spies.movementFindFirst.mockResolvedValue({ gesture_id: null, id: 'first' });
    spies.movementFindMany.mockResolvedValue([]);
    const replay = await setup.applyMovement('item', 'user', jest.fn(), { client_id: 'key' });

    expect(replay?.replayed).toBe(true);
    expect(spies.sync).not.toHaveBeenCalled();
  });

  it('SHOULD store the gesture on every movement and the idempotency key on the first one only', async () => {
    spies.movementFindFirst.mockResolvedValue(null);

    await setup.applyMovement(
      'item',
      'user',
      () => [
        { lot: { id: 'lot' }, movement: { quantity: -1, type: 'CONSUME' } },
        { lot: { id: 'lot' }, movement: { quantity: -1, type: 'CONSUME' } },
      ],
      { client_id: 'key', gesture_id: 'gesture' },
    );

    expect(spies.movementCreate.mock.calls.map((call) => call[0].data)).toEqual([
      expect.objectContaining({ client_id: 'key', gesture_id: 'gesture' }),
      expect.objectContaining({ client_id: undefined, gesture_id: 'gesture' }),
    ]);
  });

  it('SHOULD replay the stored movements WHEN the key was already applied, without planning', async () => {
    spies.movementFindFirst.mockResolvedValue({ gesture_id: 'gesture', id: 'first' });
    spies.movementFindMany.mockResolvedValue([{ id: 'first' }, { id: 'second' }]);
    const planner = jest.fn();

    const result = await setup.applyMovement('item', 'user', planner, {
      client_id: 'key',
      gesture_id: 'gesture',
    });

    expect(planner).not.toHaveBeenCalled();
    expect(result?.replayed).toBe(true);
    expect(result?.movements).toHaveLength(2);
    expect(spies.movementCreate).not.toHaveBeenCalled();
  });

  it('SHOULD propagate a planner error so the transaction rolls back', async () => {
    await expect(
      setup.applyMovement('item', 'user', () => {
        throw new Error('Not enough quantity');
      }),
    ).rejects.toThrow('Not enough quantity');
    expect(spies.lotUpdate).not.toHaveBeenCalled();
  });
});

describe('Method applyGestureChange', () => {
  const started = new Date('2026-11-18T10:00:00.000Z');
  const gestureMovement = { created_at: started, gesture_id: 'g', item_id: 'item', lot_id: 'lot' };

  beforeEach(() => {
    spies.movementFindFirst.mockResolvedValue(gestureMovement);
    spies.movementFindMany.mockResolvedValueOnce([gestureMovement]).mockResolvedValueOnce([
      { created_at: new Date('2026-11-18T10:05:00.000Z'), lot_id: 'lot' },
      { created_at: new Date('2026-11-17T10:00:00.000Z'), lot_id: 'other' },
    ]);
    spies.queryRaw.mockResolvedValue([{ id: 'item' }]);
    spies.stockFindUniqueOrThrow.mockResolvedValue({ ...mocks.stock, lots: [] });
    spies.lotFindMany.mockResolvedValue([mocks.lot]);
  });

  it('SHOULD return null WHEN the user has no such gesture, without locking', async () => {
    spies.movementFindFirst.mockResolvedValue(null);

    expect(await setup.applyGestureChange('g', 'user', jest.fn())).toBeNull();
    expect(spies.queryRaw).not.toHaveBeenCalled();
  });

  it('SHOULD tell the planner which lots had other or later movements, then apply its plan', async () => {
    const planner = jest.fn().mockReturnValue({
      create: [{ lot: { id: 'lot' }, movement: { quantity: 2, type: 'ENTRY' } }],
      delete_lot_ids: ['gone'],
      lot_updates: [{ id: 'lot', quantity: 5 }],
    });

    await setup.applyGestureChange('g', 'user', planner);

    expect(planner).toHaveBeenCalledWith(
      expect.objectContaining({ foreign_lot_ids: ['lot', 'other'], later_lot_ids: ['lot'] }),
    );
    expect(spies.movementDeleteMany).toHaveBeenCalledWith({
      where: { gesture_id: 'g', user_id: 'user' },
    });
    expect(spies.lotUpdate).toHaveBeenCalledWith({
      data: { opened_at: undefined, quantity: 5 },
      where: { id: 'lot' },
    });
    expect(spies.movementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ gesture_id: 'g', lot_id: 'lot', user_id: 'user' }),
    });
    expect(spies.lotDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ['gone'] } } });
    // Undoing an entry lowers the quantity: a dismissed row may come back (spec 118 FR 10).
    expect(spies.sync).toHaveBeenCalledWith(expect.anything(), ['item'], {
      clearDismissal: false,
    });
  });

  it('SHOULD clear the dismissal WHEN the undone gesture was an entry', async () => {
    spies.movementFindMany
      .mockReset()
      .mockResolvedValueOnce([{ ...gestureMovement, quantity: 2, type: 'ENTRY' }])
      .mockResolvedValueOnce([]);

    await setup.applyGestureChange('g', 'user', () => ({
      create: [],
      delete_lot_ids: [],
      lot_updates: [],
    }));

    expect(spies.sync).toHaveBeenCalledWith(expect.anything(), ['item'], { clearDismissal: true });
  });

  it('SHOULD write nothing WHEN the planner refuses', async () => {
    await expect(
      setup.applyGestureChange('g', 'user', () => {
        throw new Error('409');
      }),
    ).rejects.toThrow('409');
    expect(spies.movementDeleteMany).not.toHaveBeenCalled();
  });
});

describe('Method findFrequentItemIds / findByIds', () => {
  it('SHOULD rank in one grouped statement and skip the query without owners', async () => {
    spies.queryRaw.mockResolvedValue([{ item_id: 'a' }, { item_id: 'b' }]);

    expect(await setup.findFrequentItemIds([], new Date(), 5)).toEqual([]);
    expect(spies.queryRaw).not.toHaveBeenCalled();
    expect(await setup.findFrequentItemIds(mocks.owners, new Date(), 5)).toEqual(['a', 'b']);
    expect(spies.queryRaw).toHaveBeenCalledTimes(1);
  });

  it('SHOULD read the items and their open lots in two statements', async () => {
    spies.stockFindMany.mockResolvedValue([mocks.stock]);
    spies.lotFindMany.mockResolvedValue([mocks.lot]);

    expect(await setup.findByIds([])).toEqual([]);

    const rows = await setup.findByIds([mocks.stock.id]);

    expect(rows[0].lots).toEqual([mocks.lot]);
  });
});

describe('forecast refresh (spec 123)', () => {
  const today = new Date('2026-11-25T00:00:00.000Z');

  it('SHOULD list the owners items whose forecast was not computed today, stock-only excluded', async () => {
    spies.stockFindMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

    const ids = await setup.findStaleForecastItemIds(mocks.owners, today);

    expect(ids).toEqual(['a', 'b']);
    expect(spies.stockFindMany.mock.calls[0][0].where).toMatchObject({
      OR: [{ forecast_computed_on: null }, { forecast_computed_on: { lt: today } }],
      stock_only: false,
    });
  });

  it('SHOULD refresh the items in one transaction through the shared sync', async () => {
    await setup.refreshForecasts(['a', 'b'], today);

    expect(spies.sync).toHaveBeenCalledTimes(1);
    expect(spies.sync).toHaveBeenCalledWith(expect.anything(), ['a', 'b'], { today });
  });

  it('SHOULD not open a transaction for no items', async () => {
    await setup.refreshForecasts([], today);

    expect(spies.sync).not.toHaveBeenCalled();
  });

  it('SHOULD store and clear the dismissed leftover of a lot, then recompute the item', async () => {
    spies.lotUpdate.mockResolvedValue({ item_id: 'item' });

    await setup.setLeftoverDismissal('lot', 2);
    await setup.setLeftoverDismissal('lot', null);

    expect(spies.lotUpdate).toHaveBeenNthCalledWith(1, {
      data: { leftover_dismissed_at: expect.any(Date), leftover_dismissed_quantity: 2 },
      select: { item_id: true },
      where: { id: 'lot' },
    });
    expect(spies.lotUpdate).toHaveBeenNthCalledWith(2, {
      data: { leftover_dismissed_at: null, leftover_dismissed_quantity: null },
      select: { item_id: true },
      where: { id: 'lot' },
    });
    expect(spies.recompute).toHaveBeenCalledTimes(2);
  });

  it('SHOULD clear the dismissed leftover of every lot a movement touches', async () => {
    spies.stockFindUniqueOrThrow.mockResolvedValue(mocks.stock);
    spies.stockFindMany.mockResolvedValue([]);
    spies.queryRaw.mockResolvedValue([{ id: mocks.stock.id }]);
    spies.lotFindMany.mockResolvedValue([mocks.lot]);

    await setup.applyMovement('item', 'user', () => [
      { lot: { id: 'lot-a' }, update: { quantity: 1 } },
    ]);

    expect(spies.lotUpdateMany).toHaveBeenCalledWith({
      data: { leftover_dismissed_at: null, leftover_dismissed_quantity: null },
      where: { id: { in: ['lot-a'] }, leftover_dismissed_at: { not: null } },
    });
  });
});

describe('discard value (spec 123 FR 27)', () => {
  const discard = { quantity: -2, reason: 'EXPIRED' as const, type: 'DISCARD' as const };

  beforeEach(() => {
    spies.queryRaw.mockResolvedValue([{ id: 'item' }]);
    spies.stockFindUniqueOrThrow.mockResolvedValue({ ...mocks.stock, lots: [] });
    spies.movementCreate.mockResolvedValue({ id: 'm' });
  });

  it('SHOULD record the lot price x quantity with source LOT', async () => {
    spies.lotFindMany.mockResolvedValue([
      { ...mocks.lot, currency: 'BRL', id: 'lot-a', unit_price_cents: 250 },
    ]);

    await setup.applyMovement('item', 'user', () => [{ lot: { id: 'lot-a' }, movement: discard }]);

    expect(spies.movementCreate.mock.calls[0][0].data).toMatchObject({
      currency: 'BRL',
      value_cents: 500,
      value_source: 'LOT',
    });
    expect(spies.priceFindFirst).not.toHaveBeenCalled();
  });

  it('SHOULD fall back to the last price of the item (its own currency) with source ITEM_LAST', async () => {
    spies.lotFindMany.mockResolvedValue([
      { ...mocks.lot, currency: null, id: 'lot-a', unit_price_cents: null },
    ]);
    spies.priceFindFirst.mockResolvedValue({ currency: 'EUR', unit_price_cents: 300 });

    await setup.applyMovement('item', 'user', () => [{ lot: { id: 'lot-a' }, movement: discard }]);

    expect(spies.movementCreate.mock.calls[0][0].data).toMatchObject({
      currency: 'EUR',
      value_cents: 600,
      value_source: 'ITEM_LAST',
    });
  });

  it('SHOULD record NONE with no value WHEN there is no price at all', async () => {
    spies.lotFindMany.mockResolvedValue([
      { ...mocks.lot, currency: null, id: 'lot-a', unit_price_cents: null },
    ]);

    await setup.applyMovement('item', 'user', () => [{ lot: { id: 'lot-a' }, movement: discard }]);

    const data = spies.movementCreate.mock.calls[0][0].data;

    expect(data.value_source).toBe('NONE');
    expect(data.value_cents).toBeUndefined();
  });

  it('SHOULD not add a value to a movement that is not a DISCARD', async () => {
    spies.lotFindMany.mockResolvedValue([{ ...mocks.lot, id: 'lot-a' }]);

    await setup.applyMovement('item', 'user', () => [
      { lot: { id: 'lot-a' }, movement: { quantity: -1, type: 'CONSUME' as const } },
    ]);

    expect(spies.movementCreate.mock.calls[0][0].data).not.toHaveProperty('value_source');
  });
});
