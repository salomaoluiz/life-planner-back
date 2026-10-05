import { ConflictException, NotFoundException } from '@nestjs/common';

import CategoryEntityFixture from '@finance/domain/entity/mocks/CategoryEntity.fixture';

import { mocks, setup } from './index.mocks';

it('SHOULD delete an accessible category (the subtree goes with it through the FK cascade)', async () => {
  await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.category.id });

  expect(mocks.categoryRepository.deleteCategory).toHaveBeenCalledWith(mocks.category.id);
});

it.each([
  ['missing', undefined],
  ['owned by someone the caller cannot access', { ...mocks.category, ownerId: 'stranger' }],
])(
  'SHOULD throw NotFound (404) AND delete nothing WHEN the category is %s',
  async (_label, found) => {
    mocks.categoryRepository.findCategoryById.mockResolvedValueOnce(found);

    await expect(
      setup.execute({ accessibleOwners: mocks.accessibleOwners, id: mocks.category.id }),
    ).rejects.toThrow(NotFoundException);
    expect(mocks.categoryRepository.deleteCategory).not.toHaveBeenCalled();
  },
);

it('SHOULD count the transactions of the category AND of its WHOLE subtree before deleting', async () => {
  const fixture = new CategoryEntityFixture().withOwnerId(mocks.category.ownerId);
  const root = { ...mocks.category, parentId: undefined };
  const child = fixture.withId('child').withParentId(root.id).build();
  const grandchild = fixture.withId('grandchild').withParentId('child').build();
  const unrelated = fixture.withId('unrelated').build();
  mocks.categoryRepository.findCategoryById.mockResolvedValueOnce(root);
  mocks.categoryRepository.findCategories.mockResolvedValueOnce([
    unrelated,
    grandchild,
    root,
    child,
  ]);

  await setup.execute({ accessibleOwners: mocks.accessibleOwners, id: root.id });

  expect(mocks.categoryRepository.findCategories).toHaveBeenCalledWith({
    owners: [{ owner: root.owner, ownerId: root.ownerId }],
  });
  const ids = mocks.transactionRepository.countByCategoryIds.mock.calls[0][0];
  expect([...ids].sort()).toEqual([root.id, 'child', 'grandchild'].sort());
  expect(mocks.categoryRepository.deleteCategory).toHaveBeenCalledWith(root.id);
});

it('SHOULD throw Conflict (409 "Category has transactions") AND delete NOTHING WHEN the subtree has transactions', async () => {
  mocks.transactionRepository.countByCategoryIds.mockResolvedValueOnce(1);

  const promise = setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    id: mocks.category.id,
  });

  await expect(promise).rejects.toThrow(ConflictException);
  await expect(promise).rejects.toThrow('Category has transactions');
  expect(mocks.categoryRepository.deleteCategory).not.toHaveBeenCalled();
});
