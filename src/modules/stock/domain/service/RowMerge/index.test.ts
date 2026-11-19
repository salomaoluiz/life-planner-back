import { ShoppingListRowOrigins } from '@stock/domain/entity/ShoppingListRowEntity';

import { mergeRow } from './index';

it('SHOULD sum the quantities in thousandths', () => {
  expect(mergeRow({ origin: ShoppingListRowOrigins.MANUAL, quantity: 0.1 }, 0.2).quantity).toBe(
    0.3,
  );
});

it('SHOULD turn AUTO into AUTO_EDITED and keep the other origins', () => {
  expect(mergeRow({ origin: ShoppingListRowOrigins.AUTO, quantity: 6 }, 6)).toEqual({
    origin: 'AUTO_EDITED',
    quantity: 12,
  });
  expect(mergeRow({ origin: ShoppingListRowOrigins.MANUAL, quantity: 1 }, 1).origin).toBe('MANUAL');
  expect(mergeRow({ origin: ShoppingListRowOrigins.AUTO_EDITED, quantity: 1 }, 1).origin).toBe(
    'AUTO_EDITED',
  );
});
