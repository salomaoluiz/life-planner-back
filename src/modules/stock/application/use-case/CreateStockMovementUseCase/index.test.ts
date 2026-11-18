import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { ValidationError } from '@shared/domain/error/ValidationError';
import { archivedOwners, day } from '@stock/application/mocks/stock.mocks';
import { StockUnits } from '@stock/domain/entity/StockEntity';

import { item, lot, mocks, operationsOf, setup } from './index.mocks';

const base = { accessibleOwners: mocks.accessibleOwners, itemId: 'item', userId: 'user-id' };

describe('ENTRY', () => {
  it('SHOULD add to the closed lot with the same expiration (both null counts as the same)', async () => {
    const locked = item([lot('a', 2, { expirationDate: day('2026-11-20') }), lot('n', 1)], (f) =>
      f.withUnit(StockUnits.KILOGRAM),
    );

    expect(
      await operationsOf(locked, { expirationDate: '2026-11-20', quantity: 1.5, type: 'ENTRY' }),
    ).toEqual([
      {
        lot: { id: 'a' },
        movement: { note: undefined, quantity: 1.5, reason: 'PURCHASE', type: 'ENTRY' },
        update: { quantity: 3.5 },
      },
    ]);
    expect((await operationsOf(locked, { quantity: 2, type: 'ENTRY' }))[0]).toMatchObject({
      lot: { id: 'n' },
      update: { quantity: 3 },
    });
  });

  it('SHOULD create a lot WHEN the date differs, defaulting the purchase date to today, and never use an open lot', async () => {
    const locked = item([
      lot('open', 1, { expirationDate: day('2026-11-20'), openedAt: day('2026-11-01') }),
    ]);

    expect(
      await operationsOf(locked, {
        expirationDate: '2026-11-20',
        quantity: 1,
        reason: 'MANUAL',
        type: 'ENTRY',
      }),
    ).toEqual([
      {
        lot: {
          create: {
            expirationDate: day('2026-11-20'),
            purchaseDate: day('2026-11-10'),
            quantity: 1,
          },
        },
        movement: { note: undefined, quantity: 1, reason: 'MANUAL', type: 'ENTRY' },
      },
    ]);
  });

  it('SHOULD refuse decimals on a UNIT item with 422', async () => {
    await expect(operationsOf(item([]), { quantity: 1.5, type: 'ENTRY' })).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});

describe('CONSUME', () => {
  const open = lot('open', 1, { expirationDate: day('2026-12-30'), openedAt: day('2026-11-05') });
  const early = lot('early', 2, { expirationDate: day('2026-11-20') });
  const late = lot('late', 2, { expirationDate: day('2026-12-20') });

  it('SHOULD consume open lots first and span lots, one movement per lot', async () => {
    const operations = await operationsOf(item([late, early, open]), {
      quantity: 4,
      type: 'CONSUME',
    });

    expect(operations).toEqual([
      {
        lot: { id: 'open' },
        movement: { note: undefined, quantity: -1, type: 'CONSUME' },
        update: { quantity: 0 },
      },
      {
        lot: { id: 'early' },
        movement: { note: undefined, quantity: -2, type: 'CONSUME' },
        update: { quantity: 0 },
      },
      {
        lot: { id: 'late' },
        movement: { note: undefined, quantity: -1, type: 'CONSUME' },
        update: { quantity: 1 },
      },
    ]);
  });

  it('SHOULD consume only the chosen lot, with a note', async () => {
    const operations = await operationsOf(item([early, late]), {
      lotId: 'late',
      note: 'dinner',
      quantity: 1,
      type: 'CONSUME',
    });

    expect(operations).toEqual([
      {
        lot: { id: 'late' },
        movement: { note: 'dinner', quantity: -1, type: 'CONSUME' },
        update: { quantity: 1 },
      },
    ]);
  });

  it('SHOULD answer 409 WHEN the quantity exceeds the total or the chosen lot', async () => {
    await expect(operationsOf(item([early]), { quantity: 3, type: 'CONSUME' })).rejects.toThrow(
      ConflictException,
    );
    await expect(
      operationsOf(item([early, late]), { lotId: 'early', quantity: 3, type: 'CONSUME' }),
    ).rejects.toThrow('Not enough quantity');
  });

  it('SHOULD answer 404 for a lot that is not of the item', async () => {
    await expect(
      operationsOf(item([early]), { lotId: 'ghost', quantity: 1, type: 'CONSUME' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('OPEN', () => {
  const closed = lot('closed', 3, {
    expirationDate: day('2026-11-30'),
    purchaseDate: day('2026-11-01'),
  });

  it('SHOULD split the lot WHEN part stays closed: a new open lot with the same dates', async () => {
    expect(await operationsOf(item([closed]), { quantity: 1, type: 'OPEN' })).toEqual([
      { lot: { id: 'closed' }, update: { quantity: 2 } },
      {
        lot: {
          create: {
            expirationDate: day('2026-11-30'),
            openedAt: day('2026-11-10'),
            purchaseDate: day('2026-11-01'),
            quantity: 1,
          },
        },
        movement: { note: undefined, quantity: 1, type: 'OPEN' },
      },
    ]);
  });

  it('SHOULD mark the lot itself WHEN everything is opened, capping the quantity to the lot', async () => {
    expect(await operationsOf(item([closed]), { quantity: 9, type: 'OPEN' })).toEqual([
      {
        lot: { id: 'closed' },
        movement: { note: undefined, quantity: 3, type: 'OPEN' },
        update: { openedAt: day('2026-11-10') },
      },
    ]);
  });

  it('SHOULD default to the closed lot with the earliest expiration AND the quantity to 1', async () => {
    const later = lot('later', 5, { expirationDate: day('2026-12-30') });

    expect((await operationsOf(item([later, closed]), { type: 'OPEN' }))[0]).toMatchObject({
      lot: { id: 'closed' },
      update: { quantity: 2 },
    });
  });

  it('SHOULD answer 409 for an open lot and 422 WHEN there is no closed lot', async () => {
    const open = lot('open', 1, { openedAt: day('2026-11-01') });

    await expect(operationsOf(item([open]), { lotId: 'open', type: 'OPEN' })).rejects.toThrow(
      ConflictException,
    );
    await expect(operationsOf(item([open]), { type: 'OPEN' })).rejects.toThrow(
      UnprocessableEntityException,
    );
    await expect(operationsOf(item([lot('z', 0)]), { lotId: 'z', type: 'OPEN' })).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});

describe('DISCARD', () => {
  const expired = lot('old', 2, { expirationDate: day('2026-11-01') });

  it('SHOULD discard the whole lot by default with its reason', async () => {
    expect(
      await operationsOf(item([expired]), { lotId: 'old', reason: 'EXPIRED', type: 'DISCARD' }),
    ).toEqual([
      {
        lot: { id: 'old' },
        movement: { note: undefined, quantity: -2, reason: 'EXPIRED', type: 'DISCARD' },
        update: { quantity: 0 },
      },
    ]);
  });

  it('SHOULD discard part of the lot AND refuse more than it holds (409)', async () => {
    expect(
      (
        await operationsOf(item([expired]), {
          lotId: 'old',
          quantity: 1,
          reason: 'SPOILED',
          type: 'DISCARD',
        })
      )[0],
    ).toMatchObject({ update: { quantity: 1 } });
    await expect(
      operationsOf(item([expired]), {
        lotId: 'old',
        quantity: 3,
        reason: 'OTHER',
        type: 'DISCARD',
      }),
    ).rejects.toThrow(ConflictException);
    await expect(
      operationsOf(item([lot('empty', 0)]), { lotId: 'empty', reason: 'OTHER', type: 'DISCARD' }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('ADJUST', () => {
  it('SHOULD set the counted quantity on the lot with the most quantity and record the signed delta', async () => {
    expect(
      await operationsOf(item([lot('a', 1), lot('b', 5)]), { countedQuantity: 3, type: 'ADJUST' }),
    ).toEqual([
      {
        lot: { id: 'b' },
        movement: { note: undefined, quantity: -2, type: 'ADJUST' },
        update: { quantity: 3 },
      },
    ]);
  });

  it('SHOULD adjust the chosen lot upward', async () => {
    expect(
      (
        await operationsOf(item([lot('a', 1), lot('b', 5)]), {
          countedQuantity: 4,
          lotId: 'a',
          type: 'ADJUST',
        })
      )[0],
    ).toMatchObject({
      lot: { id: 'a' },
      movement: { quantity: 3 },
    });
  });

  it('SHOULD create a lot WHEN the item is empty and something was counted, and do nothing WHEN nothing changed', async () => {
    expect(await operationsOf(item([]), { countedQuantity: 2, type: 'ADJUST' })).toEqual([
      {
        lot: { create: { quantity: 2 } },
        movement: { note: undefined, quantity: 2, type: 'ADJUST' },
      },
    ]);
    expect(await operationsOf(item([]), { countedQuantity: 0, type: 'ADJUST' })).toEqual([]);
    expect(await operationsOf(item([lot('a', 2)]), { countedQuantity: 2, type: 'ADJUST' })).toEqual(
      [],
    );
  });
});

describe('execute', () => {
  it('SHOULD return the item view and the movements the repository wrote', async () => {
    const written = [{ id: 'm' }];

    mocks.stock.applyMovement.mockResolvedValue({ item: item([lot('a', 2)]), movements: written });

    const result = await setup.execute({ ...base, quantity: 1, type: 'CONSUME' });

    expect(result.item.quantity).toBe(2);
    expect(result.movements).toBe(written);
    expect(mocks.stock.applyMovement).toHaveBeenCalledWith(
      'item',
      'user-id',
      expect.any(Function),
      {
        clientId: undefined,
        gestureId: undefined,
      },
    );
  });

  it('SHOULD answer 404 WHEN the item is not visible or vanished during the write', async () => {
    mocks.stock.findById.mockResolvedValue(undefined);
    await expect(setup.execute({ ...base, quantity: 1, type: 'CONSUME' })).rejects.toThrow(
      NotFoundException,
    );

    mocks.stock.findById.mockResolvedValue(item([lot('a', 1)]));
    mocks.stock.applyMovement.mockResolvedValue(undefined);
    await expect(setup.execute({ ...base, quantity: 1, type: 'CONSUME' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('SHOULD refuse writes on an archived family (422) before locking anything', async () => {
    mocks.stock.findById.mockResolvedValue(
      item([lot('a', 1)], (f) => f.withOwner('FAMILY' as never).withOwnerId('family-id')),
    );

    await expect(
      setup.execute({ ...base, accessibleOwners: archivedOwners, quantity: 1, type: 'CONSUME' }),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(mocks.stock.applyMovement).not.toHaveBeenCalled();
  });

  it('SHOULD throw ValidationError for a body that does not fit its type', async () => {
    await expect(setup.execute({ ...base, quantity: 0, type: 'CONSUME' })).rejects.toThrow(
      ValidationError,
    );
    await expect(setup.execute({ ...base, type: 'DISCARD' } as never)).rejects.toThrow(
      ValidationError,
    );
    await expect(setup.execute({ ...base, type: 'NOPE' } as never)).rejects.toThrow(
      ValidationError,
    );
  });

  it('SHOULD use kg precision rules for kilogram items', async () => {
    const kg = item([lot('a', 1)], (f) => f.withUnit(StockUnits.KILOGRAM));

    expect(await operationsOf(kg, { quantity: 0.25, type: 'CONSUME' })).toHaveLength(1);
    await expect(operationsOf(kg, { quantity: 0.0001, type: 'CONSUME' })).rejects.toThrow(
      UnprocessableEntityException,
    );
  });
});

describe('quick movement (spec 117)', () => {
  const expired = lot('old', 2, { expirationDate: day('2026-11-01') });
  const valid = lot('new', 3, { expirationDate: day('2026-12-20') });

  it('SHOULD record a DISCARD/EXPIRED and a CONSUME WHEN DISCARD_THEN_VALID', async () => {
    const operations = await operationsOf(item([expired, valid]), {
      expiredLots: 'DISCARD_THEN_VALID',
      quantity: 1,
      type: 'CONSUME',
    });

    expect(operations).toEqual([
      expect.objectContaining({
        lot: { id: 'old' },
        movement: expect.objectContaining({ quantity: -2, reason: 'EXPIRED', type: 'DISCARD' }),
        update: { quantity: 0 },
      }),
      expect.objectContaining({
        lot: { id: 'new' },
        movement: expect.objectContaining({ quantity: -1, type: 'CONSUME' }),
        update: { quantity: 2 },
      }),
    ]);
  });

  it('SHOULD skip expired lots by default and answer 409 WHEN only expired lots hold stock', async () => {
    expect(
      (await operationsOf(item([expired, valid]), { quantity: 1, type: 'CONSUME' }))[0],
    ).toMatchObject({ lot: { id: 'new' } });
    await expect(operationsOf(item([expired]), { quantity: 1, type: 'CONSUME' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('SHOULD consume the expired lot first WHEN EXPIRED_FIRST', async () => {
    expect(
      (
        await operationsOf(item([valid, expired]), {
          expiredLots: 'EXPIRED_FIRST',
          quantity: 3,
          type: 'CONSUME',
        })
      ).map((operation) => operation.lot),
    ).toEqual([{ id: 'old' }, { id: 'new' }]);
  });

  it('SHOULD add an ENTRY to the closed lot with the latest expiration WHEN target is LATEST_CLOSED', async () => {
    const early = lot('early', 1, { expirationDate: day('2026-11-20') });
    const late = lot('late', 1, { expirationDate: day('2026-11-30') });
    const open = lot('open', 1, { expirationDate: day('2027-01-01'), openedAt: day('2026-11-01') });

    expect(
      (
        await operationsOf(item([early, late, open]), {
          quantity: 2,
          reason: 'MANUAL',
          target: 'LATEST_CLOSED',
          type: 'ENTRY',
        })
      )[0],
    ).toMatchObject({ lot: { id: 'late' }, update: { quantity: 3 } });
  });

  it('SHOULD refuse expiredLots on a non-CONSUME movement with 422', async () => {
    mocks.stock.findById.mockResolvedValue(item([expired]));
    await expect(
      setup.execute({ ...base, expiredLots: 'VALID_ONLY', quantity: 1, type: 'ENTRY' } as never),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('SHOULD pass gestureId and clientId to the repository', async () => {
    const gestureId = '9b1c0000-0000-4000-8000-000000000001';
    const clientId = '3f0e0000-0000-4000-8000-000000000002';

    await setup.execute({ ...base, clientId, gestureId, quantity: 1, type: 'CONSUME' } as never);

    expect(mocks.stock.applyMovement).toHaveBeenLastCalledWith(
      'item',
      'user-id',
      expect.any(Function),
      { clientId, gestureId },
    );
  });
});
