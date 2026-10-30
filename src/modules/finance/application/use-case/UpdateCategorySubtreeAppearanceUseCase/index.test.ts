import { mocks, setup } from './index.mocks';

function descendants() {
  return [
    { iconColor: '#112233', id: mocks.child.id },
    { icon: 'folder', iconColor: '#445566', id: mocks.grandchild.id },
  ];
}

it('SHOULD delegate to UpdateCategoryUseCase with the descendants as subtreeAppearance', async () => {
  await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    callerId: mocks.userId,
    descendants: descendants(),
    icon: 'folder',
    id: mocks.edited.id,
  });

  expect(mocks.updateCategoryUseCase.execute).toHaveBeenCalledWith({
    accessibleOwners: mocks.accessibleOwners,
    callerId: mocks.userId,
    icon: 'folder',
    id: mocks.edited.id,
    subtreeAppearance: descendants(),
  });
});

it('SHOULD return the edited category followed by the stored descendants of the request', async () => {
  const result = await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    descendants: descendants(),
    id: mocks.edited.id,
  });

  expect(result.map((category) => category.id)).toEqual([
    mocks.edited.id,
    mocks.child.id,
    mocks.grandchild.id,
  ]);
  expect(mocks.categoryRepository.findCategories).toHaveBeenCalledWith({
    owners: mocks.edited.scopes,
  });
});

it('SHOULD skip a descendant that is no longer stored', async () => {
  mocks.categoryRepository.findCategories.mockResolvedValue([mocks.edited]);

  const result = await setup.execute({
    accessibleOwners: mocks.accessibleOwners,
    descendants: descendants(),
    id: mocks.edited.id,
  });

  expect(result).toEqual([mocks.edited]);
});

it('SHOULD NOT read anything WHEN the update fails (nothing was written)', async () => {
  mocks.updateCategoryUseCase.execute.mockRejectedValue(
    new Error('Descendant is not in the subtree'),
  );

  await expect(
    setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      descendants: descendants(),
      id: mocks.edited.id,
    }),
  ).rejects.toThrow('Descendant is not in the subtree');
  expect(mocks.categoryRepository.findCategories).not.toHaveBeenCalled();
});
