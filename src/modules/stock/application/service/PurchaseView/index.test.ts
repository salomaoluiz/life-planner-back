import {
  item,
  purchase,
  purchaseRow,
  shoppingList,
  shoppingRow,
} from '@stock/application/mocks/stock.mocks';

import { toPurchaseRowView, toPurchaseView } from './index';

const day = new Date('2026-10-21T00:00:00.000Z');

describe('toPurchaseRowView', () => {
  it('SHOULD carry the last price AND the price change notice', () => {
    const view = toPurchaseRowView(
      purchaseRow('r', { itemId: 'i', unitPriceCents: 4290 }),
      new Map([['i', { date: day, unitPriceCents: 3640 }]]),
    );

    expect(view.lastPrice).toEqual({ date: day, unitPriceCents: 3640 });
    expect(view.priceChangePercent).toBe(18);
    expect(view.priceChangeNotice).toBe('UP');
  });

  it('SHOULD have no change without history AND read the description from the item', () => {
    const view = toPurchaseRowView(
      purchaseRow('r', {
        item: { description: 'Rice', id: 'i', unit: 'unit' as never },
        itemId: 'i',
      }),
      new Map(),
    );

    expect(view.priceChangePercent).toBeNull();
    expect(view.description).toBe('Rice');
  });
});

describe('toPurchaseView', () => {
  const list = shoppingList('list-id');

  it('SHOULD total the cart AND estimate what remains with the manual or last market price', () => {
    const view = toPurchaseView({
      lastPrices: new Map([['i2', { date: day, unitPriceCents: 500 }]]),
      listRows: [
        shoppingRow('l1', list, { price: 300, quantity: 2 }),
        shoppingRow('l2', list, {
          item: {
            ...(item().id && { id: 'i2' }),
            description: 'Milk',
            owner: 'USER' as never,
            ownerId: 'user-id',
            quantity: 0,
            unit: 'unit' as never,
          } as never,
          quantity: 2,
        }),
        shoppingRow('l3', list),
        shoppingRow('l4', list),
      ],
      otherCarts: [],
      purchase: purchase('p'),
      purchaseRows: [
        purchaseRow('r1', { lineTotalCents: 1000, listRowId: 'l3' }),
        purchaseRow('r2', { listRowId: 'l4', state: 'NOT_FOUND' }),
      ],
      takenListRowIds: new Set(['l3']),
    });

    expect(view.cart).toEqual({ count: 1, totalCents: 1000, unpricedCount: 0 });
    expect(view.remaining).toEqual({ count: 2, estimatedCents: 1600, pricedCount: 2 });
    expect(view.forecastCents).toBe(2600);
  });
});
