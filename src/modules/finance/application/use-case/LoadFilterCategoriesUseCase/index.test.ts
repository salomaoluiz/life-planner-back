import { mocks, setup } from './index.mocks';

describe('execute', () => {
  it('SHOULD NOT read categories WHEN the filter has no category ids and no text', async () => {
    expect(await setup.execute({ accessibleOwners: mocks.accessibleOwners })).toBeUndefined();
    expect(
      await setup.execute({
        accessibleOwners: mocks.accessibleOwners,
        filter: { categoryIds: [] },
      }),
    ).toBeUndefined();
    expect(mocks.categoryRepository.findCategories).not.toHaveBeenCalled();
  });

  it.each([{ categoryIds: ['market'] }, { q: 'pizza' }, { categoryIds: ['market'], q: 'pizza' }])(
    'SHOULD read the categories of the accessible owners ONCE WHEN the filter is %j',
    async (filter) => {
      const result = await setup.execute({ accessibleOwners: mocks.accessibleOwners, filter });

      expect(result).toBe(mocks.categories);
      expect(mocks.categoryRepository.findCategories).toHaveBeenCalledTimes(1);
      expect(mocks.categoryRepository.findCategories).toHaveBeenCalledWith({
        owners: mocks.accessibleOwners,
      });
    },
  );
});
