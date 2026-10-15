import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD delete the user by id AND resolve (also when nothing was left to delete)', async () => {
  await expect(setup.execute({ id: mocks.userId })).resolves.toBeUndefined();

  expect(mocks.userRepository.deleteUser).toHaveBeenCalledTimes(1);
  expect(mocks.userRepository.deleteUser).toHaveBeenCalledWith(mocks.userId);
});

it('SHOULD throw ValidationError WHEN the id is not a uuid', async () => {
  await expect(setup.execute({ id: 'nope' })).rejects.toThrow(ValidationError);
  expect(mocks.userRepository.deleteUser).not.toHaveBeenCalled();
});

it('SHOULD propagate a repository failure', async () => {
  mocks.userRepository.deleteUser.mockRejectedValueOnce(new Error('db down'));

  await expect(setup.execute({ id: mocks.userId })).rejects.toThrow('db down');
});
