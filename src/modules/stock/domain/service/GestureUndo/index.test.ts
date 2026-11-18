import { StockMovementTypes } from '@stock/domain/entity/StockMovementEntity';

import { planUndo } from './index';

function day(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

describe('planUndo', () => {
  const lotA = { createdByGesture: false, id: 'a', quantity: 2 };

  it('SHOULD give back what a CONSUME took', () => {
    const plan = planUndo([{ lotId: 'a', quantity: -3, type: StockMovementTypes.CONSUME }], [lotA]);

    expect(plan).toEqual({ deleteLotIds: [], lotUpdates: [{ id: 'a', quantity: 5 }] });
  });

  it('SHOULD restore a DISCARD and a CONSUME of the same gesture on different lots', () => {
    const plan = planUndo(
      [
        { lotId: 'a', quantity: -2, type: StockMovementTypes.DISCARD },
        { lotId: 'b', quantity: -1, type: StockMovementTypes.CONSUME },
      ],
      [
        { ...lotA, quantity: 0 },
        { createdByGesture: false, id: 'b', quantity: 4 },
      ],
    );

    expect(plan.lotUpdates).toEqual([
      { id: 'a', quantity: 2 },
      { id: 'b', quantity: 5 },
    ]);
  });

  it('SHOULD take an ENTRY back and delete the lot the gesture created', () => {
    const plan = planUndo(
      [{ lotId: 'n', quantity: 2, type: StockMovementTypes.ENTRY }],
      [{ createdByGesture: true, id: 'n', quantity: 2 }],
    );

    expect(plan).toEqual({ deleteLotIds: ['n'], lotUpdates: [] });
  });

  it('SHOULD only reduce an existing lot WHEN an ENTRY joined it', () => {
    const plan = planUndo(
      [{ lotId: 'a', quantity: 3, type: StockMovementTypes.ENTRY }],
      [{ ...lotA, quantity: 5 }],
    );

    expect(plan.lotUpdates).toEqual([{ id: 'a', quantity: 2 }]);
  });

  it('SHOULD merge an OPEN split back into the closed lot with the same dates', () => {
    const origin = {
      createdByGesture: false,
      expirationDate: day('2026-12-01'),
      id: 'origin',
      purchaseDate: day('2026-11-01'),
      quantity: 2,
    };
    const opened = {
      createdByGesture: true,
      expirationDate: day('2026-12-01'),
      id: 'opened',
      openedAt: day('2026-11-18'),
      purchaseDate: day('2026-11-01'),
      quantity: 1,
    };
    const plan = planUndo(
      [{ lotId: 'opened', quantity: 1, type: StockMovementTypes.OPEN }],
      [origin, opened],
    );

    expect(plan).toEqual({
      deleteLotIds: ['opened'],
      lotUpdates: [{ id: 'origin', quantity: 3 }],
    });
  });

  it('SHOULD clear openedAt WHEN the whole lot was opened', () => {
    const plan = planUndo(
      [{ lotId: 'a', quantity: 2, type: StockMovementTypes.OPEN }],
      [{ ...lotA, openedAt: day('2026-11-18') }],
    );

    expect(plan).toEqual({ deleteLotIds: [], lotUpdates: [{ id: 'a', openedAt: null }] });
  });

  it('SHOULD refuse WHEN the reversal would leave a negative quantity', () => {
    expect(() =>
      planUndo([{ lotId: 'a', quantity: 5, type: StockMovementTypes.ENTRY }], [lotA]),
    ).toThrow('NEGATIVE');
  });
});
