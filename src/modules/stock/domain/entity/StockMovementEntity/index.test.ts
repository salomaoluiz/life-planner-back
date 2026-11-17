import StockMovementEntity, { StockMovementReasons, StockMovementTypes } from './index';

const date = new Date('2026-11-10T00:00:00.000Z');

it('SHOULD keep every property', () => {
  const movement = new StockMovementEntity({
    createdAt: date,
    id: 'm',
    itemId: 'item',
    lotId: 'lot',
    note: 'note',
    quantity: -1,
    reason: StockMovementReasons.EXPIRED,
    type: StockMovementTypes.DISCARD,
    userId: 'user',
  });

  expect(movement).toMatchObject({ lotId: 'lot', quantity: -1, type: 'DISCARD', userId: 'user' });
});

it('SHOULD leave note, reason and user undefined WHEN they are not given', () => {
  const movement = new StockMovementEntity({
    createdAt: date,
    id: 'm',
    itemId: 'item',
    lotId: 'lot',
    quantity: 1,
    type: StockMovementTypes.ENTRY,
  });

  expect(movement.note).toBeUndefined();
  expect(movement.reason).toBeUndefined();
  expect(movement.userId).toBeUndefined();
});
