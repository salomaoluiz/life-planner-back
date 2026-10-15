import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD delete exactly that owner AND return the count', async () => {
  expect(await setup.execute(mocks.input)).toBe(2);
  expect(mocks.stockRepository.deleteByOwner).toHaveBeenCalledWith(mocks.input);
});

it('SHOULD return 0 WHEN the owner has no items', async () => {
  mocks.stockRepository.deleteByOwner.mockResolvedValueOnce(0);

  expect(await setup.execute(mocks.input)).toBe(0);
});

it.each([
  { owner: 'GROUP', ownerId: 'x' },
  { owner: 'USER', ownerId: '' },
])('SHOULD throw ValidationError AND delete nothing WHEN the owner is %p', async (input) => {
  await expect(setup.execute(input as never)).rejects.toThrow(ValidationError);
  expect(mocks.stockRepository.deleteByOwner).not.toHaveBeenCalled();
});

it('SHOULD propagate a repository failure', async () => {
  mocks.stockRepository.deleteByOwner.mockRejectedValueOnce(new Error('db down'));

  await expect(setup.execute(mocks.input)).rejects.toThrow('db down');
});
