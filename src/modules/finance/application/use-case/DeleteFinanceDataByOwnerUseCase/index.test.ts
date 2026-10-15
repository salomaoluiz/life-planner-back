import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD delete exactly that owner AND return the count', async () => {
  expect(await setup.execute(mocks.input)).toBe(5);
  expect(mocks.ownerDataRepository.deleteAllByOwner).toHaveBeenCalledTimes(1);
  expect(mocks.ownerDataRepository.deleteAllByOwner).toHaveBeenCalledWith(mocks.input);
});

it('SHOULD return 0 WHEN the owner has nothing', async () => {
  mocks.ownerDataRepository.deleteAllByOwner.mockResolvedValueOnce(0);

  expect(await setup.execute(mocks.input)).toBe(0);
});

it.each([
  { owner: 'GROUP', ownerId: 'x' },
  { owner: 'USER', ownerId: '' },
])('SHOULD throw ValidationError AND delete nothing WHEN the owner is %p', async (input) => {
  await expect(setup.execute(input as never)).rejects.toThrow(ValidationError);
  expect(mocks.ownerDataRepository.deleteAllByOwner).not.toHaveBeenCalled();
});

it('SHOULD propagate a repository failure (the API answers 500 and the user row stays)', async () => {
  mocks.ownerDataRepository.deleteAllByOwner.mockRejectedValueOnce(new Error('db down'));

  await expect(setup.execute(mocks.input)).rejects.toThrow('db down');
});
