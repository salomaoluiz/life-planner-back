import StockLotEntity from './index';

const day = new Date('2026-11-10T00:00:00.000Z');

it('SHOULD keep every property', () => {
  const lot = new StockLotEntity({
    createdAt: day,
    expirationDate: day,
    id: 'lot',
    itemId: 'item',
    openedAt: day,
    purchaseDate: day,
    quantity: 1.5,
  });

  expect(lot).toMatchObject({ id: 'lot', itemId: 'item', openedAt: day, quantity: 1.5 });
});

it('SHOULD leave the dates undefined WHEN they are not given', () => {
  const lot = new StockLotEntity({ createdAt: day, id: 'lot', itemId: 'item', quantity: 1 });

  expect(lot.expirationDate).toBeUndefined();
  expect(lot.openedAt).toBeUndefined();
  expect(lot.purchaseDate).toBeUndefined();
});
