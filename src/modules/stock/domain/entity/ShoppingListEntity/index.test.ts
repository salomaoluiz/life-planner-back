import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

import ShoppingListEntity from './index';

it('SHOULD keep every property', () => {
  const date = new Date('2026-11-10T00:00:00.000Z');
  const list = new ShoppingListEntity({
    createdAt: date,
    currency: 'BRL',
    id: 'l',
    isDefault: true,
    name: 'Groceries',
    owner: OwnerType.FAMILY,
    ownerId: 'f',
    purchaseIntervalDays: 7,
    status: StockCatalogStatus.ACTIVE,
    updatedAt: date,
  });

  expect(list).toMatchObject({ currency: 'BRL', isDefault: true, name: 'Groceries' });
});
