import { mocks, setup } from './index.mocks';

it('SHOULD embed every item without a vector, batch after batch, and stop when none is left', async () => {
  mocks.suggestions.findWithoutEmbedding
    .mockResolvedValueOnce([
      { id: 'a', text: 'Milk' },
      { id: 'b', text: 'Rice' },
    ])
    .mockResolvedValueOnce([]);
  mocks.embeddings.embed.mockResolvedValue([1]);

  expect(await setup.execute()).toEqual({ failed: 0, processed: 2 });
  expect(mocks.suggestions.setEmbedding).toHaveBeenCalledTimes(2);
  expect(mocks.embeddings.embed).toHaveBeenCalledWith('Milk', { timeoutMs: 10000 });
});

it('SHOULD stop WHEN the provider gives no vector for a whole batch (never loops on the same rows)', async () => {
  mocks.suggestions.findWithoutEmbedding.mockResolvedValue([{ id: 'a', text: 'Milk' }]);
  mocks.embeddings.embed.mockResolvedValue(null);

  expect(await setup.execute()).toEqual({ failed: 1, processed: 0 });
  expect(mocks.suggestions.setEmbedding).not.toHaveBeenCalled();
});

it('SHOULD skip an item that already failed and count it WHEN others succeed', async () => {
  mocks.suggestions.findWithoutEmbedding
    .mockResolvedValueOnce([
      { id: 'a', text: 'Bad' },
      { id: 'b', text: 'Good' },
    ])
    .mockResolvedValueOnce([{ id: 'a', text: 'Bad' }]);
  mocks.embeddings.embed.mockImplementation(async (text: string) => (text === 'Good' ? [1] : null));

  expect(await setup.execute()).toEqual({ failed: 1, processed: 1 });
});
