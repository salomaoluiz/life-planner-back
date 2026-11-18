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

    await setup.update({ id: 'x', min_quantity: null, notes: 'n' });

    expect(spies.stockUpdate).toHaveBeenCalledWith({
      data: { min_quantity: null, notes: 'n' },
      include: expect.any(Object),
      where: { id: 'x' },
    });
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
      },
    ]);
    expect(result?.movements).toHaveLength(2);
    expect(result?.item.id).toBe(mocks.stock.id);
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
