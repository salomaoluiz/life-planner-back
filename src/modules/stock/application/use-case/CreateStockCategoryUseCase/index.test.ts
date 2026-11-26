import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { archivedOwners, category } from '@stock/application/mocks/stock.mocks';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

import { mocks, setup } from './index.mocks';

const input = {
  accessibleOwners: mocks.accessibleOwners,
  color: '#F59E0B',
  icon: 'cart',
  name: 'Dairy',
  owner: OwnerType.USER,
  ownerId: 'user-id',
};

beforeEach(() => {
  mocks.catalog.findCategories.mockResolvedValue([]);
  mocks.catalog.createCategory.mockImplementation(async (params) => category('new', params));
});

it('SHOULD create a root category with a finance mapping to an active expense category', async () => {
  await setup.execute({
    ...input,
    financeCategories: [{ archived: false, id: 'fin', isExpense: true }],
    financeCategoryId: 'fin',
  });

  expect(mocks.catalog.createCategory).toHaveBeenCalledWith({
    color: '#F59E0B',
    financeCategoryId: 'fin',
    icon: 'cart',
    name: 'Dairy',
    owner: 'USER',
    ownerId: 'user-id',
    parentId: undefined,
  });
});

it('SHOULD create a subcategory under an active parent up to the depth limit', async () => {
  mocks.catalog.findCategories.mockResolvedValue([
    category('root'),
    category('mid', { parentId: 'root' }),
  ]);

  await setup.execute({ ...input, parentId: 'mid' });
  expect(mocks.catalog.createCategory).toHaveBeenCalledWith(
    expect.objectContaining({ parentId: 'mid' }),
  );
});

it.each([
  ['an unknown parent', [], 'x'],
  ['an archived parent', [category('p', { status: StockCatalogStatus.ARCHIVED })], 'p'],
  [
    'a fourth level',
    [category('a'), category('b', { parentId: 'a' }), category('c', { parentId: 'b' })],
    'c',
  ],
])('SHOULD refuse %s with 422', async (_label, existing, parentId) => {
  mocks.catalog.findCategories.mockResolvedValue(existing);

  await expect(setup.execute({ ...input, parentId })).rejects.toThrow(UnprocessableEntityException);
  expect(mocks.catalog.createCategory).not.toHaveBeenCalled();
});

it('SHOULD refuse a sibling with the same name (case-insensitive) with 409, but allow it under another parent', async () => {
  mocks.catalog.findCategories.mockResolvedValue([category('x', { name: 'DAIRY' }), category('p')]);

  await expect(setup.execute(input)).rejects.toThrow(ConflictException);
  await expect(setup.execute({ ...input, parentId: 'p' })).resolves.toBeDefined();
});

it('SHOULD refuse an INCOME, archived or unknown finance category with 422', async () => {
  await expect(
    setup.execute({
      ...input,
      financeCategories: [{ archived: false, id: 'f', isExpense: false }],
      financeCategoryId: 'f',
    }),
  ).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD answer 404 for a foreign owner and 422 for an archived family', async () => {
  await expect(setup.execute({ ...input, ownerId: 'other' })).rejects.toThrow(NotFoundException);
  await expect(
    setup.execute({
      ...input,
      accessibleOwners: archivedOwners,
      owner: OwnerType.FAMILY,
      ownerId: 'family-id',
    }),
  ).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD refuse an icon missing from the catalog with 422 ICON_NOT_FOUND, and an invalid color', async () => {
  await expect(setup.execute({ ...input, icon: 'nope', iconCatalog: ['cart'] })).rejects.toThrow(
    UnprocessableEntityException,
  );
  await expect(setup.execute({ ...input, color: 'red' })).rejects.toThrow();
  expect(mocks.catalog.createCategory).not.toHaveBeenCalled();
});
