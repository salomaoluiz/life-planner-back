import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD return the whole catalog by group order then sort WHEN there is no query', async () => {
  const result = await setup.execute({});

  expect(result).toEqual([mocks.food, mocks.car, mocks.folder]);
  expect(mocks.iconRepository.search).not.toHaveBeenCalled();
});

it('SHOULD treat a blank or symbol-only query as no query', async () => {
  await setup.execute({ q: '  &|:* ' });

  expect(mocks.iconRepository.listAll).toHaveBeenCalled();
  expect(mocks.iconRepository.search).not.toHaveBeenCalled();
});

it('SHOULD search by normalized prefix terms with the default limit of 60', async () => {
  const result = await setup.execute({ q: 'Pásta' });

  expect(result).toEqual([mocks.folder]);
  expect(mocks.iconRepository.search).toHaveBeenCalledWith({ limit: 60, terms: ['pasta'] });
  expect(mocks.iconRepository.searchSimilar).not.toHaveBeenCalled();
});

it('SHOULD fall back to trigram similarity WHEN the search is empty and the input has 3+ characters', async () => {
  mocks.iconRepository.search.mockResolvedValue([]);

  const result = await setup.execute({ limit: 10, q: 'psata' });

  expect(result).toEqual([mocks.folder]);
  expect(mocks.iconRepository.searchSimilar).toHaveBeenCalledWith({ limit: 10, text: 'psata' });
});

it('SHOULD NOT use the fallback for inputs shorter than 3 characters', async () => {
  mocks.iconRepository.search.mockResolvedValue([]);

  expect(await setup.execute({ q: 'ab' })).toEqual([]);
  expect(mocks.iconRepository.searchSimilar).not.toHaveBeenCalled();
});

it('SHOULD reject a limit out of range', async () => {
  await expect(setup.execute({ limit: 201, q: 'a' })).rejects.toThrow(ValidationError);
  await expect(setup.execute({ limit: 0, q: 'a' })).rejects.toThrow(ValidationError);
});
