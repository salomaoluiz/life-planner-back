import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';

import { mocks, setup, spies } from './index.mocks';

const owner = { owner: OwnerType.USER, ownerId: 'user' };

it('SHOULD translate create params to columns (first lot included) AND map the result', async () => {
  const result = await setup.create({
    description: 'Rice',
    firstLot: { expirationDate: new Date('2026-12-01'), quantity: 2 },
    minQuantity: 1,
    owner: OwnerType.USER,
    ownerId: 'user',
    stockOnly: false,
    unit: StockUnits.KILOGRAM,
    userId: 'u',
    warnDaysClosed: 7,
    warnDaysOpened: 1,
  });

  expect(mocks.datasource.create).toHaveBeenCalledWith(
    expect.objectContaining({
      description: 'Rice',
      first_lot: expect.objectContaining({ expiration_date: new Date('2026-12-01'), quantity: 2 }),
      min_quantity: 1,
      owner_id: 'user',
      user_id: 'u',
    }),
  );
  expect(result).toBe(mocks.entity);
});

it('SHOULD create without a first lot', async () => {
  await setup.create({
    description: 'Rice',
    owner: OwnerType.USER,
    ownerId: 'user',
    stockOnly: true,
    unit: StockUnits.UNIT,
    userId: 'u',
    warnDaysClosed: 7,
    warnDaysOpened: 1,
  });

  expect(mocks.datasource.create.mock.calls[0][0].first_lot).toBeUndefined();
});

it('SHOULD delegate delete, deleteByOwner and existsByOwner', async () => {
  mocks.datasource.deleteByOwner.mockResolvedValue(4);
  mocks.datasource.exists.mockResolvedValue(true);

  await setup.delete('x');
  expect(mocks.datasource.delete).toHaveBeenCalledWith('x');
  expect(await setup.deleteByOwner(owner)).toBe(4);
  expect(mocks.datasource.deleteByOwner).toHaveBeenCalledWith({ owner: 'USER', owner_id: 'user' });
  expect(await setup.existsByOwner(owner)).toBe(true);
});

it('SHOULD map findById, returning undefined WHEN missing', async () => {
  expect(await setup.findById('x')).toBe(mocks.entity);

  mocks.datasource.findById.mockResolvedValue(null);
  expect(await setup.findById('x')).toBeUndefined();
});

it('SHOULD map findByOwners AND translate the filter', async () => {
  expect(await setup.findByOwners([owner], { categoryIds: ['c'], locationIds: ['l'] })).toEqual([
    mocks.entity,
  ]);
  expect(mocks.datasource.findByOwners).toHaveBeenCalledWith([owner], {
    category_ids: ['c'],
    location_ids: ['l'],
  });

  await setup.findByOwners([owner]);
  expect(mocks.datasource.findByOwners).toHaveBeenLastCalledWith([owner], undefined);
});

it('SHOULD map the movements page', async () => {
  const cursor = { createdAt: new Date(), id: 'x' };

  expect(await setup.findMovements('item', 31, cursor)).toEqual([{ id: 'movement' }]);
  expect(mocks.datasource.findMovements).toHaveBeenCalledWith('item', 31, cursor);
});

it('SHOULD translate update params to columns', async () => {
  await setup.update({
    categoryId: null,
    id: 'x',
    openedShelfLifeDays: 5,
    stockOnly: true,
    warnDaysClosed: 3,
  });

  expect(mocks.datasource.update).toHaveBeenCalledWith(
    expect.objectContaining({
      category_id: null,
      id: 'x',
      opened_shelf_life_days: 5,
      stock_only: true,
      warn_days_closed: 3,
    }),
  );
});

describe('applyMovement', () => {
  it('SHOULD return undefined WHEN the item is gone', async () => {
    mocks.datasource.applyMovement.mockResolvedValue(null);

    expect(await setup.applyMovement('item', 'user', () => [])).toBeUndefined();
  });

  it('SHOULD translate the plan of the domain to columns inside the lock AND map the result', async () => {
    mocks.datasource.applyMovement.mockImplementation(async (_id, _user, planner) => {
      const operations = planner({ id: 'item' }, [{ id: 'lot' }]);

      expect(operations).toEqual([
        {
          lot: {
            create: {
              expiration_date: new Date('2026-12-01'),
              opened_at: undefined,
              purchase_date: undefined,
              quantity: 1,
            },
          },
          movement: { quantity: 1, type: 'ENTRY' },
          update: undefined,
        },
        {
          lot: { id: 'lot' },
          movement: undefined,
          update: { opened_at: new Date('2026-11-10'), quantity: 2 },
        },
      ]);

      return { item: rawItemWithLots, movements: [{ id: 'm' }] };
    });
    const rawItemWithLots = { id: 'item', lots: [] };
    const planner = jest.fn().mockReturnValue([
      {
        lot: { create: { expirationDate: new Date('2026-12-01'), quantity: 1 } },
        movement: { quantity: 1, type: 'ENTRY' },
      },
      { lot: { id: 'lot' }, update: { openedAt: new Date('2026-11-10'), quantity: 2 } },
    ]);

    const result = await setup.applyMovement('item', 'user', planner);

    expect(spies.toDomain).toHaveBeenCalledWith({ id: 'item', lots: [{ id: 'lot' }] });
    expect(result).toEqual({ item: mocks.entity, movements: [{ id: 'movement' }] });
  });
});

describe('spec 117', () => {
  it('SHOULD pass the key and gesture of a movement to the datasource and return `replayed`', async () => {
    mocks.datasource.applyMovement.mockResolvedValue({
      item: mocks.raw,
      movements: [],
      replayed: true,
    });

    const result = await setup.applyMovement('item', 'user', () => [], {
      clientId: 'key',
      gestureId: 'g',
    });

    expect(mocks.datasource.applyMovement).toHaveBeenCalledWith(
      'item',
      'user',
      expect.any(Function),
      {
        client_id: 'key',
        gesture_id: 'g',
      },
    );
    expect(result?.replayed).toBe(true);
  });

  it('SHOULD translate a gesture plan to columns and map the item', async () => {
    mocks.datasource.applyGestureChange.mockImplementation(async (_g, _u, planner) => {
      planner({
        foreign_lot_ids: ['a'],
        item: mocks.raw,
        later_lot_ids: [],
        lots: [],
        movements: [{ id: 'm' }],
      });

      return mocks.raw;
    });

    const planner = jest.fn().mockReturnValue({
      create: [{ lot: { create: { expirationDate: new Date('2026-12-05'), quantity: 2 } } }],
      deleteLotIds: ['gone'],
      lotUpdates: [{ id: 'a', quantity: 1 }],
    });
    const result = await setup.applyGestureChange('g', 'user', planner);

    expect(planner).toHaveBeenCalledWith(
      expect.objectContaining({ foreignLotIds: ['a'], laterLotIds: [] }),
    );
    expect(result?.item).toBe(mocks.entity);
  });

  it('SHOULD answer undefined WHEN the gesture is not found', async () => {
    mocks.datasource.applyGestureChange.mockResolvedValue(null);

    expect(await setup.applyGestureChange('g', 'user', jest.fn())).toBeUndefined();
  });

  it('SHOULD keep the order of the ids and skip unknown ones in findByIds, and pass frequent through', async () => {
    mocks.datasource.findByIds.mockResolvedValue([{ id: 'b' }, { id: 'a' }]);
    mocks.datasource.findFrequentItemIds.mockResolvedValue(['a']);

    await setup.findByIds(['a', 'x', 'b']);

    expect(spies.toDomain.mock.calls.map((call) => (call[0] as { id: string }).id)).toEqual([
      'a',
      'b',
    ]);
    expect(await setup.findFrequentItemIds([owner], new Date(), 5)).toEqual(['a']);
  });
});
