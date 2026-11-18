import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { datasource, setup } from './index.mocks';

it('SHOULD ask for the owner, the thresholds of the score AND map the rows', async () => {
  datasource.findSuggestions.mockResolvedValue([
    {
      brand: 'B',
      description: 'Milk',
      distance: 0.1,
      id: 'a',
      quantity: 2,
      trigram: 0.5,
      unit: 'liter',
    },
    {
      brand: null,
      description: 'Rice',
      distance: null,
      id: 'b',
      quantity: 0,
      trigram: 0.4,
      unit: 'unit',
    },
  ]);

  const rows = await setup.findSuggestions({
    embedding: [1],
    ownerAccess: { owner: OwnerType.FAMILY, ownerId: 'family' },
    query: 'milk',
  });

  expect(datasource.findSuggestions).toHaveBeenCalledWith({
    embedding: [1],
    limit: 8,
    max_distance: 0.25,
    min_trigram: 0.3,
    owner: 'FAMILY',
    owner_id: 'family',
    query: 'milk',
  });
  expect(rows[0]).toMatchObject({ brand: 'B', distance: 0.1, unit: 'liter' });
  expect(rows[1].brand).toBeUndefined();
  expect(rows[1].distance).toBeUndefined();
});

it('SHOULD honor a custom limit', async () => {
  datasource.findSuggestions.mockResolvedValue([]);

  await setup.findSuggestions({
    limit: 3,
    ownerAccess: { owner: OwnerType.USER, ownerId: 'u' },
    query: 'x',
  });

  expect(datasource.findSuggestions.mock.calls[0][0].limit).toBe(3);
});

it('SHOULD delegate the embedding reads and writes', async () => {
  datasource.findEmbeddingText.mockResolvedValueOnce('Milk').mockResolvedValueOnce(null);
  datasource.findWithoutEmbedding.mockResolvedValue([{ id: 'a', text: 'Milk' }]);

  expect(await setup.findEmbeddingText('a')).toBe('Milk');
  expect(await setup.findEmbeddingText('a')).toBeUndefined();
  expect(await setup.findWithoutEmbedding(10)).toEqual([{ id: 'a', text: 'Milk' }]);
  await setup.setEmbedding('a', [1]);
  expect(datasource.setEmbedding).toHaveBeenCalledWith('a', [1]);
});
