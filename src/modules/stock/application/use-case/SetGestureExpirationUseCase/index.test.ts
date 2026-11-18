import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { day, item, lot } from '@stock/application/mocks/stock.mocks';
import StockMovementEntity, { StockMovementTypes } from '@stock/domain/entity/StockMovementEntity';

import { captured, mocks, run, setup } from './index.mocks';

const gestureId = '9b1c0000-0000-4000-8000-000000000001';
const createdAt = new Date('2026-11-18T10:00:00.000Z');
const base = {
  accessibleOwners: mocks.accessibleOwners,
  expirationDate: '2026-12-05',
  gestureId,
  now: new Date(createdAt.getTime() + 60_000),
  today: '2026-11-18',
  userId: 'user-id',
};

function entry(lotId: string, quantity: number, type = StockMovementTypes.ENTRY) {
  return new StockMovementEntity({
    createdAt,
    gestureId,
    id: `m-${lotId}`,
    itemId: 'item',
    lotId,
    quantity,
    type,
  });
}

describe('execute', () => {
  it('SHOULD return the quantity to its lot and create a closed lot with the chosen date', async () => {
    const late = lot('late', 5, { expirationDate: day('2026-11-30') });

    run({
      item: item([lot('early', 1, { expirationDate: day('2026-11-20') }), late]),
      movements: [entry('late', 2)],
    });

    await setup.execute(base);

    expect(captured.plan).toEqual({
      create: [
        {
          lot: {
            create: {
              expirationDate: day('2026-12-05'),
              purchaseDate: day('2026-11-18'),
              quantity: 2,
            },
          },
          movement: { quantity: 2, reason: 'MANUAL', type: 'ENTRY' },
        },
      ],
      deleteLotIds: [],
      lotUpdates: [{ id: 'late', quantity: 3 }],
    });
  });

  it('SHOULD add to the closed lot that already has the chosen date', async () => {
    run({
      item: item([
        lot('late', 5, { expirationDate: day('2026-11-30') }),
        lot('dec', 1, { expirationDate: day('2026-12-05') }),
      ]),
      movements: [entry('late', 2)],
    });

    await setup.execute(base);

    expect(captured.plan?.create[0]).toMatchObject({ lot: { id: 'dec' }, update: { quantity: 3 } });
  });

  it('SHOULD delete the lot the gesture created and answer 422 WHEN the gesture is not an ENTRY', async () => {
    run({ item: item([lot('n', 2)]), movements: [entry('n', 2)] });
    await setup.execute(base);
    expect(captured.plan?.deleteLotIds).toEqual(['n']);

    run({ item: item([lot('n', 2)]), movements: [entry('n', -1, StockMovementTypes.CONSUME)] });
    await expect(setup.execute(base)).rejects.toThrow(UnprocessableEntityException);
  });

  it('SHOULD answer 404 WHEN the user has no such gesture', async () => {
    mocks.stock.applyGestureChange.mockResolvedValue(undefined);

    await expect(setup.execute(base)).rejects.toThrow(NotFoundException);
  });
});
