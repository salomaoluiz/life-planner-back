import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD remove the user AND return the counts', async () => {
  const result = await setup.execute({ email: 'test@example.com', userId: mocks.userId });

  expect(result).toEqual({ families: 1, memberships: 2 });
});

it('SHOULD pass the NORMALIZED email to the repository', async () => {
  await setup.execute({ email: '  TEST@Example.com ', userId: mocks.userId });

  expect(mocks.familyRepository.removeUser).toHaveBeenCalledWith({
    email: 'test@example.com',
    userId: mocks.userId,
  });
});

it('SHOULD resolve with zero counts WHEN nothing is left (retry)', async () => {
  mocks.familyRepository.removeUser.mockResolvedValueOnce({ families: 0, memberships: 0 });

  expect(await setup.execute({ email: 'test@example.com', userId: mocks.userId })).toEqual({
    families: 0,
    memberships: 0,
  });
});

it('SHOULD throw ValidationError WHEN the user id is not a uuid', async () => {
  await expect(setup.execute({ email: 'test@example.com', userId: 'x' })).rejects.toThrow(
    ValidationError,
  );
  expect(mocks.familyRepository.removeUser).not.toHaveBeenCalled();
});

it('SHOULD propagate a repository failure', async () => {
  mocks.familyRepository.removeUser.mockRejectedValueOnce(new Error('db down'));

  await expect(setup.execute({ email: 'test@example.com', userId: mocks.userId })).rejects.toThrow(
    'db down',
  );
});
