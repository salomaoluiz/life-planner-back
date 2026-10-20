import { mocks, setup } from './index.mocks';

describe('execute', () => {
  it('SHOULD return the ids plus every descendant', async () => {
    mocks.categoryRepository.findCategories.mockResolvedValue([
      mocks.category('market'),
      mocks.category('greens', 'market'),
      mocks.category('butcher', 'market'),
      mocks.category('home'),
    ]);

    const result = await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      categoryIds: ['market'],
    });

    expect(result.sort()).toEqual(['butcher', 'greens', 'market']);
  });

  it('SHOULD keep an id that is not found', async () => {
    const result = await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      categoryIds: ['unknown'],
    });

    expect(result).toEqual(['unknown']);
  });

  it('SHOULD not read categories when nothing was chosen', async () => {
    const result = await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      categoryIds: [],
    });

    expect(result).toEqual([]);
    expect(mocks.categoryRepository.findCategories).not.toHaveBeenCalled();
  });
});
