import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import StockCategoryEntity, { StockCatalogStatus } from './index';

const date = new Date('2026-11-10T00:00:00.000Z');
const base = {
  createdAt: date,
  id: 'c',
  name: 'Dairy',
  owner: OwnerType.USER,
  ownerId: 'u',
  status: StockCatalogStatus.ACTIVE,
  updatedAt: date,
};

it('SHOULD keep every property', () => {
  expect(new StockCategoryEntity({ ...base, financeCategoryId: 'f', parentId: 'p' })).toMatchObject(
    {
      financeCategoryId: 'f',
      parentId: 'p',
      status: 'ACTIVE',
    },
  );
});

it('SHOULD leave the parent and mapping undefined WHEN they are not given', () => {
  const category = new StockCategoryEntity(base);

  expect(category.parentId).toBeUndefined();
  expect(category.financeCategoryId).toBeUndefined();
});
