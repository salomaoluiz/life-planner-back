import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { ValidationError } from '@shared/domain/error/ValidationError';
import { StockUnits } from '@stock/domain/entity/StockEntity';

import { mocks, setup } from './index.mocks';

const input = {
  accessibleOwners: mocks.accessibleOwners,
  owner: OwnerType.USER,
  ownerId: 'user-id',
  q: 'musarela',
};
function row(id: string, description: string, trigram: number, distance?: number) {
  return {
    description,
    distance,
    id,
    quantity: 2,
    trigram,
    unit: StockUnits.UNIT,
  };
}

it('SHOULD work with trigram only WHEN there is no embedding (provider off, slow or failing)', async () => {
  mocks.suggestions.findSuggestions.mockResolvedValue([row('a', 'Queijo muçarela', 0.62)]);

  const result = await setup.execute(input);

  expect(mocks.suggestions.findSuggestions).toHaveBeenCalledWith(
    expect.objectContaining({ embedding: undefined, limit: 8, query: 'musarela' }),
  );
  expect(result).toEqual([
    {
      brand: undefined,
      description: 'Queijo muçarela',
      id: 'a',
      quantity: 2,
      score: 0.62,
      unit: 'unit',
    },
  ]);
});

it('SHOULD pass the query embedding AND rank by the best of both signals, dropping weak rows', async () => {
  mocks.embeddings.embed.mockResolvedValue([0.1]);
  mocks.suggestions.findSuggestions.mockResolvedValue([
    row('weak', 'Nothing alike', 0.1, 0.9),
    row('typo', 'Requeijão', 0.4),
    row('meaning', 'Refrigerante', 0, 0.1),
  ]);

  const result = await setup.execute({ ...input, q: 'refri' });

  expect(mocks.suggestions.findSuggestions).toHaveBeenCalledWith(
    expect.objectContaining({ embedding: [0.1] }),
  );
  expect(result.map((suggestion) => suggestion.id)).toEqual(['meaning', 'typo']);
});

it('SHOULD return nothing for an owner the caller cannot access, without reading or embedding', async () => {
  expect(await setup.execute({ ...input, ownerId: 'other' })).toEqual([]);
  expect(mocks.embeddings.embed).not.toHaveBeenCalled();
  expect(mocks.suggestions.findSuggestions).not.toHaveBeenCalled();
});

it('SHOULD throw ValidationError WHEN the query is shorter than 2 characters', async () => {
  await expect(setup.execute({ ...input, q: 'a' })).rejects.toThrow(ValidationError);
});

describe('without an owner (quick add, spec 117 FR 29)', () => {
  it('SHOULD search every writable owner, skip archived families and merge the results', async () => {
    mocks.suggestions.findSuggestions
      .mockResolvedValueOnce([row('a', 'Leite integral', 0.7)])
      .mockResolvedValueOnce([row('b', 'Leite de coco', 0.8)]);

    const result = await setup.execute({
      accessibleOwners: [
        ...mocks.accessibleOwners,
        { archived: true, owner: OwnerType.FAMILY, ownerId: 'archived-family' },
      ],
      q: 'leite',
    });

    expect(mocks.suggestions.findSuggestions).toHaveBeenCalledTimes(2);
    expect(result.map((suggestion) => suggestion.id)).toEqual(['b', 'a']);
  });

  it('SHOULD answer an empty list WHEN the user has no owner to search', async () => {
    expect(await setup.execute({ accessibleOwners: [], q: 'leite' })).toEqual([]);
  });
});
