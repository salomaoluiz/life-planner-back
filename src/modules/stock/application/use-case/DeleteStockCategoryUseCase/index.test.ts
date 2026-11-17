import { ConflictException, NotFoundException } from '@nestjs/common';

import { category } from '@stock/application/mocks/stock.mocks';

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

  expect(mocks.catalog.deleteCategory).toHaveBeenCalledWith('root');
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
