import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { ValidationError } from '@shared/domain/error/ValidationError';
import { category } from '@stock/application/mocks/stock.mocks';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

import { mocks, setup } from './index.mocks';

const tree = [
  category('root'),
  category('mid', { parentId: 'root' }),
  category('leaf', { parentId: 'mid' }),
  category('other'),
];
const input = { accessibleOwners: mocks.accessibleOwners, id: 'mid' };

beforeEach(() => {
  mocks.catalog.findCategoryById.mockImplementation(async (id: string) =>
    tree.find((c) => c.id === id),
  );
  mocks.catalog.findCategories.mockResolvedValue(tree);
  mocks.catalog.updateCategory.mockImplementation(async (params) => category(params.id));
});

it('SHOULD rename, map to finance and re-parent', async () => {
  await setup.execute({
    ...input,
    financeCategories: [{ archived: false, id: 'fin', isExpense: true }],
    financeCategoryId: 'fin',
    name: 'Cheese',
    parentId: 'other',
  });

  expect(mocks.catalog.updateCategory).toHaveBeenCalledWith({
    financeCategoryId: 'fin',
    id: 'mid',
    name: 'Cheese',
    parentId: 'other',
  });
});

it('SHOULD move to the root with parentId null AND clear the mapping with null', async () => {
  await setup.execute({ ...input, financeCategoryId: null, parentId: null });

  expect(mocks.catalog.updateCategory).toHaveBeenCalledWith(
    expect.objectContaining({ financeCategoryId: null, parentId: null }),
  );
});

it('SHOULD archive the category with its whole subtree in one call', async () => {
  const updated = await setup.execute({ ...input, status: StockCatalogStatus.ARCHIVED });

  expect(mocks.catalog.setCategoryStatus).toHaveBeenCalledWith(['mid', 'leaf'], 'ARCHIVED');
  expect(updated.status).toBe('ARCHIVED');
  expect(mocks.catalog.updateCategory).not.toHaveBeenCalled();
});

it('SHOULD reactivate WHEN the parent is active and refuse under an archived parent (422)', async () => {
  const archived = [
    category('root', { status: StockCatalogStatus.ARCHIVED }),
    category('mid', { parentId: 'root', status: StockCatalogStatus.ARCHIVED }),
  ];

  mocks.catalog.findCategoryById.mockImplementation(async (id: string) =>
    archived.find((c) => c.id === id),
  );
  mocks.catalog.findCategories.mockResolvedValue(archived);

  await expect(setup.execute({ ...input, status: StockCatalogStatus.ACTIVE })).rejects.toThrow(
    'Reactivate the parent category first',
  );
  await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    id: 'root',
    status: StockCatalogStatus.ACTIVE,
  });
  expect(mocks.catalog.setCategoryStatus).toHaveBeenCalledWith(['root', 'mid'], 'ACTIVE');
});

it.each([
  ['under itself or a descendant', { parentId: 'leaf' }],
  ['under an unknown parent', { parentId: 'ghost' }],
  ['exceeding the depth limit', { id: 'root', parentId: 'leaf' }],
])('SHOULD refuse moving %s with 422', async (_label, extra) => {
  await expect(setup.execute({ ...input, ...extra })).rejects.toThrow(UnprocessableEntityException);
});

it('SHOULD refuse moving under an archived parent and exceeding the depth with a subtree (422)', async () => {
  const withArchived = [...tree, category('old', { status: StockCatalogStatus.ARCHIVED })];

  mocks.catalog.findCategories.mockResolvedValue(withArchived);
  await expect(setup.execute({ ...input, parentId: 'old' })).rejects.toThrow(
    'Parent category is archived',
  );

  mocks.catalog.findCategories.mockResolvedValue([
    ...tree,
    category('deep', { parentId: 'other' }),
    category('deeper', { parentId: 'deep' }),
  ]);
  await expect(setup.execute({ ...input, parentId: 'deeper' })).rejects.toThrow(
    UnprocessableEntityException,
  );
});

it('SHOULD refuse a name already used by a sibling (409) but allow keeping its own', async () => {
  mocks.catalog.findCategories.mockResolvedValue([
    ...tree,
    category('twin', { name: 'CHEESE', parentId: 'root' }),
  ]);

  await expect(setup.execute({ ...input, name: 'cheese' })).rejects.toThrow(ConflictException);
  await expect(setup.execute({ ...input, name: 'Category mid' })).resolves.toBeDefined();
});

it('SHOULD answer 404 for a category of another owner and ValidationError for an empty body', async () => {
  mocks.catalog.findCategoryById.mockResolvedValue(category('x', { ownerId: 'other' }));
  await expect(setup.execute({ ...input, name: 'x' })).rejects.toThrow(NotFoundException);

  mocks.catalog.findCategoryById.mockResolvedValue(undefined);
  await expect(setup.execute({ ...input, name: 'x' })).rejects.toThrow(NotFoundException);
  await expect(setup.execute(input)).rejects.toThrow(ValidationError);
});
