import { NotFoundException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { category } from '@stock/application/mocks/stock.mocks';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

import { mocks, setup } from './index.mocks';

const input = {
  accessibleOwners: mocks.accessibleOwners,
  owner: OwnerType.USER,
  ownerId: 'user-id',
};

beforeEach(() => {
  mocks.catalog.findCategories.mockResolvedValue([
    category('dairy', { financeCategoryId: 'fin' }),
    category('cheese', { parentId: 'dairy' }),
    category('old', { status: StockCatalogStatus.ARCHIVED }),
  ]);
  mocks.catalog.countItemsByCategory.mockResolvedValue(new Map([['cheese', 4]]));
});

it('SHOULD return the active categories with item counts and the inherited finance mapping', async () => {
  const rows = await setup.execute(input);

  expect(
    rows.map((row) => [row.category.id, row.itemCount, row.effectiveFinanceCategoryId]),
  ).toEqual([
    ['dairy', 0, 'fin'],
    ['cheese', 4, 'fin'],
  ]);
});

it('SHOULD include archived categories WHEN asked', async () => {
  expect(
    (await setup.execute({ ...input, includeArchived: true })).map((row) => row.category.id),
  ).toContain('old');
});

it('SHOULD answer 404 for an owner the caller cannot reach', async () => {
  await expect(setup.execute({ ...input, ownerId: 'other' })).rejects.toThrow(NotFoundException);
});
