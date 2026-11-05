import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD return the favorite account id of the user with ONE read', async () => {
  mocks.favoriteRepository.findByUser.mockResolvedValue('account-1');

  expect(await setup.execute({ userId: 'user-id' })).toBe('account-1');
  expect(mocks.favoriteRepository.findByUser).toHaveBeenCalledTimes(1);
  expect(mocks.favoriteRepository.findByUser).toHaveBeenCalledWith('user-id');
});

it('SHOULD return undefined WHEN the user has none (never inferred)', async () => {
  mocks.favoriteRepository.findByUser.mockResolvedValue(undefined);

  expect(await setup.execute({ userId: 'user-id' })).toBeUndefined();
});

it('SHOULD throw ValidationError WHEN userId is empty', async () => {
  await expect(setup.execute({ userId: '' })).rejects.toThrow(ValidationError);
});
