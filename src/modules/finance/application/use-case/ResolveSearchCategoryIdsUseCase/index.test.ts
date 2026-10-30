import { mocks, setup } from './index.mocks';

describe('execute', () => {
  it('SHOULD return the categories named by the query AND all their descendants', async () => {
    mocks.categoryRepository.findCategories.mockResolvedValue([
      mocks.category('transport', 'Transporte'),
      mocks.category('app', 'Aplicativo', 'transport'),
      mocks.category('uber', 'Uber', 'app'),
      mocks.category('food', 'Alimentação'),
    ]);

    const result = await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      q: 'transporte',
    });

    expect(result.sort()).toEqual(['app', 'transport', 'uber']);
  });

  it('SHOULD ignore case and accents', async () => {
    mocks.categoryRepository.findCategories.mockResolvedValue([
      mocks.category('food', 'Alimentação'),
    ]);

    expect(
      await setup.execute({ accessibleOwners: mocks.accessibleOwners, q: ' ALIMENTACAO ' }),
    ).toEqual(['food']);
  });

  it('SHOULD match a subcategory by its own name without the parent', async () => {
    mocks.categoryRepository.findCategories.mockResolvedValue([
      mocks.category('transport', 'Transporte'),
      mocks.category('app', 'Aplicativo', 'transport'),
    ]);

    expect(await setup.execute({ accessibleOwners: mocks.accessibleOwners, q: 'aplic' })).toEqual([
      'app',
    ]);
  });

  it('SHOULD terminate on a corrupted parent cycle', async () => {
    mocks.categoryRepository.findCategories.mockResolvedValue([
      mocks.category('a', 'Casa', 'b'),
      mocks.category('b', 'Lar', 'a'),
    ]);

    const result = await setup.execute({ accessibleOwners: mocks.accessibleOwners, q: 'casa' });

    expect(result.sort()).toEqual(['a', 'b']);
  });

  it('SHOULD return nothing WHEN no category matches', async () => {
    mocks.categoryRepository.findCategories.mockResolvedValue([
      mocks.category('food', 'Alimentação'),
    ]);

    expect(await setup.execute({ accessibleOwners: mocks.accessibleOwners, q: 'carro' })).toEqual(
      [],
    );
  });
});
