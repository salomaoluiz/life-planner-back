import { NotFoundException } from '@nestjs/common';

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
