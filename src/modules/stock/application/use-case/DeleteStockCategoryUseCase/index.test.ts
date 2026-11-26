import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { category } from '@stock/application/mocks/stock.mocks';
import { StockCatalogStatus } from '@stock/domain/entity/StockCategoryEntity';

import { mocks, setup } from './index.mocks';

const input = { accessibleOwners: mocks.accessibleOwners, id: 'root' };

beforeEach(() => {
  mocks.catalog.findCategoryById.mockResolvedValue(category('root'));
  mocks.catalog.findCategories.mockResolvedValue([
    category('root'),
    category('kid', { parentId: 'root' }),
  ]);
});

it('SHOULD delete a category nobody uses', async () => {
  await setup.execute(input);

  expect(mocks.catalog.deleteCategory).toHaveBeenCalledWith('root', undefined);
});

it('SHOULD answer 409 with the item count WHEN an item of the subtree uses it', async () => {
  mocks.catalog.countItemsByCategory.mockResolvedValue(
    new Map([
      ['kid', 2],
      ['root', 1],
    ]),
  );

  const error = await setup.execute(input).catch((caught) => caught);

  expect(error).toBeInstanceOf(ConflictException);
  expect(error.getResponse()).toMatchObject({ itemCount: 3 });
  expect(mocks.catalog.deleteCategory).not.toHaveBeenCalled();
});

it('SHOULD answer 404 WHEN the category is missing or of another owner', async () => {
  mocks.catalog.findCategoryById.mockResolvedValue(undefined);
  await expect(setup.execute(input)).rejects.toThrow(NotFoundException);

  mocks.catalog.findCategoryById.mockResolvedValue(category('root', { ownerId: 'other' }));
  await expect(setup.execute(input)).rejects.toThrow(NotFoundException);
});

describe('WHEN items of the subtree use it', () => {
  beforeEach(() => {
    mocks.catalog.findCategories.mockResolvedValue([
      category('root'),
      category('kid', { parentId: 'root' }),
      category('other'),
      category('old', { status: StockCatalogStatus.ARCHIVED }),
    ]);
    mocks.catalog.countItemsByCategory.mockResolvedValue(
      new Map([
        ['kid', 2],
        ['root', 1],
      ]),
    );
  });

  it('SHOULD move the items of the whole subtree to the target and delete', async () => {
    await setup.execute({ ...input, moveTo: 'other' });

    expect(mocks.catalog.deleteCategory).toHaveBeenCalledWith('root', {
      from: ['root', 'kid'],
      to: 'other',
    });
  });

  it('SHOULD leave the items without a category WHEN moveTo is none', async () => {
    await setup.execute({ ...input, moveTo: 'none' });

    expect(mocks.catalog.deleteCategory).toHaveBeenCalledWith('root', {
      from: ['root', 'kid'],
      to: null,
    });
  });

  it.each(['kid', 'old', 'elsewhere'])('SHOULD refuse %s as target with 422', async (moveTo) => {
    await expect(setup.execute({ ...input, moveTo })).rejects.toThrow(UnprocessableEntityException);
    expect(mocks.catalog.deleteCategory).not.toHaveBeenCalled();
  });
});
