import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD embed the name and brand text AND store the vector', async () => {
  expect(await setup.execute({ id: 'item' })).toBe(true);
  expect(mocks.embeddings.embed).toHaveBeenCalledWith('Milk Brand', { timeoutMs: 5000 });
  expect(mocks.suggestions.setEmbedding).toHaveBeenCalledWith('item', [0.1, 0.2]);
});

it('SHOULD do nothing WHEN the item is gone', async () => {
  mocks.suggestions.findEmbeddingText.mockResolvedValue(undefined);

  expect(await setup.execute({ id: 'item' })).toBe(false);
  expect(mocks.embeddings.embed).not.toHaveBeenCalled();
});

it('SHOULD leave the column null WHEN the provider returns no vector', async () => {
  mocks.embeddings.embed.mockResolvedValue(null);

  expect(await setup.execute({ id: 'item' })).toBe(false);
  expect(mocks.suggestions.setEmbedding).not.toHaveBeenCalled();
});

it('SHOULD throw ValidationError WHEN the id is empty', async () => {
  await expect(setup.execute({ id: '' })).rejects.toThrow(ValidationError);
});
